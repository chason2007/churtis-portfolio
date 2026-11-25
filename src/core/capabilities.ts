/**
 * Capability detection + render budget.
 *
 * Runs once, before any Three.js code is downloaded, and answers two questions:
 *
 *   1. Should we boot the 3D experience at all?
 *   2. If so, how much can this device afford?
 *
 * Everything the scene allocates (particle counts, pixel ratio, post-processing
 * passes) is read from the returned budget rather than hardcoded, so a weak
 * device gets a lighter scene instead of a janky one.
 *
 * The probe creates a throwaway WebGL context and immediately loses it, so it
 * costs a fraction of a frame and leaks nothing.
 */

export type Tier = 'high' | 'medium' | 'low' | 'mobile' | 'none';

export interface RenderBudget {
  /** Instances in the hero name field. */
  nameParticles: number;
  /** Instances in the ambient dust field. */
  dustParticles: number;
  /** Instances in each zone structure along the camera path. */
  zoneParticles: number;
  /** Hard cap on devicePixelRatio — the single biggest fill-rate lever. */
  maxPixelRatio: number;
  /** Enable the UnrealBloom pass. */
  bloom: boolean;
  /** Bloom resolution divisor (higher = cheaper, softer). */
  bloomDivisor: number;
  /** Enable the grain/vignette composite pass. */
  grain: boolean;
  /** MSAA samples on the render target (0 = off). */
  msaa: number;
}

export interface Capabilities {
  tier: Tier;
  /**
   * True when the user asked the OS for less motion.
   *
   * This no longer forces the 2D layout — the 3D scene is the default on any
   * capable desktop. It instead suppresses every piece of *autonomous* motion
   * inside it: the intro cinematic, the idle camera float, pointer parallax,
   * particle drift and twinkle, and smooth-scroll easing. What remains is
   * strictly scroll-linked, which is direct manipulation rather than animation.
   * Anyone who wants the flat page outright can still ask for `?mode=flat`.
   */
  reducedMotion: boolean;
  /** Coarse pointer / small viewport — drives the 2D layout decision. */
  isMobile: boolean;
  /** True when a WebGL2 context could actually be created. */
  webgl2: boolean;
  /** Unmasked GPU string when the browser exposes it (diagnostics only). */
  renderer: string | null;
  /** True when a software rasteriser was detected (SwiftShader, llvmpipe…). */
  softwareRenderer: boolean;
  /** navigator.hardwareConcurrency, or 0 when unknown. */
  cores: number;
  /** navigator.deviceMemory in GB, or 0 when unknown. */
  memoryGB: number;
  /** The final verdict: render the WebGL scene, or the 2D fallback. */
  use3D: boolean;
  budget: RenderBudget;
}

/**
 * Dev / QA overrides, read from the query string.
 *
 *   ?mode=3d     force the WebGL experience (still refused without WebGL2)
 *   ?mode=flat   force the 2D layout
 *   ?tier=low    force a render budget: low | medium | high
 *
 * Useful because the two paths are otherwise hard to see on one machine — if
 * your OS has "reduce motion" enabled, for instance, you will only ever get the
 * flat layout. `?mode=3d` never overrides a genuine capability failure.
 */
function readOverrides(): { mode: '3d' | 'flat' | null; tier: Tier | null } {
  if (typeof window === 'undefined') return { mode: null, tier: null };

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const tier = params.get('tier');

  return {
    mode: mode === '3d' || mode === 'flat' ? mode : null,
    tier:
      tier === 'low' || tier === 'medium' || tier === 'high' || tier === 'mobile' ? tier : null,
  };
}

const SOFTWARE_HINTS = ['swiftshader', 'llvmpipe', 'softwarerasterizer', 'basic render', 'mesa offscreen'];

/** Budgets per tier. Tuned so the mid tier holds 60fps on an integrated GPU. */
const BUDGETS: Record<Exclude<Tier, 'none'>, RenderBudget> = {
  high: {
    nameParticles: 15000,
    dustParticles: 2000,
    zoneParticles: 6000,
    maxPixelRatio: 1.75,
    bloom: true,
    bloomDivisor: 2,
    grain: true,
    msaa: 0, // particles are soft-edged; MSAA buys nothing and costs bandwidth
  },
  medium: {
    nameParticles: 10000,
    dustParticles: 1000,
    zoneParticles: 3600,
    maxPixelRatio: 1.5,
    bloom: true,
    bloomDivisor: 3,
    grain: true,
    msaa: 0,
  },
  mobile: {
    nameParticles: 7500,
    dustParticles: 750,
    zoneParticles: 2600,
    maxPixelRatio: 1.35,
    bloom: true,
    bloomDivisor: 4,
    grain: true,
    msaa: 0,
  },
  low: {
    nameParticles: 6500,
    dustParticles: 500,
    zoneParticles: 2000,
    maxPixelRatio: 1,
    bloom: false,
    bloomDivisor: 4,
    grain: true,
    msaa: 0,
  },
};

const NO_BUDGET: RenderBudget = {
  nameParticles: 0,
  dustParticles: 0,
  zoneParticles: 0,
  maxPixelRatio: 1,
  bloom: false,
  bloomDivisor: 4,
  grain: false,
  msaa: 0,
};

function probeGL(): { webgl2: boolean; renderer: string | null } {
  if (typeof document === 'undefined') return { webgl2: false, renderer: null };

  const canvas = document.createElement('canvas');
  const gl =
    (canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) as WebGL2RenderingContext | null) ?? null;

  if (!gl) return { webgl2: false, renderer: null };

  let renderer: string | null = null;
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const value = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    if (typeof value === 'string') renderer = value;
  }

  // Release the probe context immediately — browsers cap live contexts per page.
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  return { webgl2: true, renderer };
}

export function detectCapabilities(): Capabilities {
  const overrides = readOverrides();

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const coarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const narrow = typeof window !== 'undefined' && window.innerWidth < 860;
  const isMobile = coarsePointer || narrow;

  const { webgl2, renderer } = probeGL();
  const softwareRenderer =
    renderer !== null && SOFTWARE_HINTS.some((hint) => renderer.toLowerCase().includes(hint));

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const cores = nav?.hardwareConcurrency ?? 0;
  const memoryGB = (nav as unknown as { deviceMemory?: number } | undefined)?.deviceMemory ?? 0;

  // A real capability failure is never overridable — there is nothing to
  // render with.
  const canRender3D = webgl2 && !softwareRenderer;

  let tier: Tier;
  if (!canRender3D) {
    tier = 'none';
  } else if (overrides.mode === 'flat') {
    tier = 'none';
  } else if (overrides.tier) {
    tier = overrides.tier;
  } else if (overrides.mode === '3d') {
    tier = cores >= 8 ? 'high' : 'medium';
  } else if (isMobile) {
    // Serve the 3D scene on capable mobile GPUs using the mobile budget;
    // constrained devices drop down to the lightest tier without bloom.
    tier = (cores > 0 && cores < 4) || (memoryGB > 0 && memoryGB <= 2) ? 'low' : 'mobile';
  } else if (cores >= 8 && (memoryGB === 0 || memoryGB >= 8)) {
    tier = 'high';
  } else if (cores >= 4) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  const use3D = tier !== 'none';

  return Object.freeze({
    tier,
    reducedMotion,
    isMobile,
    webgl2,
    renderer,
    softwareRenderer,
    cores,
    memoryGB,
    use3D,
    budget: use3D ? BUDGETS[tier as Exclude<Tier, 'none'>] : NO_BUDGET,
  });
}
