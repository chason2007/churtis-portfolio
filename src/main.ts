import './styles/main.css';

import { detectCapabilities, type Capabilities } from './core/capabilities';
import { applyContent } from './ui/content';
import { Hero } from './ui/Hero';
import { Loader } from './ui/Loader';
import { maybe } from './ui/dom';

/**
 * Entry point.
 *
 * Deliberately small, and the only module that knows about the whole app. Its
 * job is to decide *what kind of site this visitor gets* before anything heavy
 * is downloaded, then drive the boot sequence:
 *
 *   capability check → content binding → fonts → [3D chunk] → first frame → reveal
 *
 * Three.js is behind a dynamic import, so a phone, a software rasteriser or a
 * visitor who asked for reduced motion never pays for it.
 */

/** Where the loader's progress bar sits at each boot milestone. */
const STEP = {
  start: 0.06,
  content: 0.18,
  fonts: 0.34,
  chunk: 0.56,
  scene: 0.82,
  frame: 0.97,
} as const;

async function boot(): Promise<void> {
  const html = document.documentElement;

  // Tells CSS that JS is alive and may hide things it intends to animate in.
  // If the bundle fails to load this never runs and the page stays fully visible.
  html.dataset.anim = 'on';

  const loader = new Loader();
  loader.set(STEP.start, 'Initialising');

  const capabilities = detectCapabilities();
  html.dataset.mode = capabilities.use3D ? '3d' : 'flat';
  if (capabilities.reducedMotion) html.dataset.reducedMotion = 'true';

  if (import.meta.env.DEV) {
    console.info('[boot] capabilities', capabilities);
  }

  applyContent(document);
  loader.set(STEP.content, 'Loading type');

  // Both faces are self-hosted and in the critical CSS, so this is quick — but
  // the wordmark is rasterised from the display face, so it must be resident.
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      /* A font failure is cosmetic; carry on with the fallback stack. */
    }
  }
  loader.set(STEP.fonts, 'Preparing scene');

  const hero = new Hero({ reducedMotion: capabilities.reducedMotion });

  if (!capabilities.use3D) {
    await bootFlat(loader, hero);
    return;
  }

  try {
    await boot3D(loader, hero, capabilities);
  } catch (error) {
    // A WebGL failure must never cost the visitor the content. Fall back to the
    // flat layout and carry on.
    console.error('[boot] 3D experience failed to start — falling back to the flat layout', error);
    html.dataset.mode = 'flat';
    html.removeAttribute('data-stage');
    maybe('#stage')?.remove();
    await bootFlat(loader, hero);
  }
}

/** The 2D path: no canvas, no Three.js, same content. */
async function bootFlat(loader: Loader, hero: Hero): Promise<void> {
  // Nothing will ever draw into it, so take it out of the DOM rather than
  // leaving an empty compositing layer behind.
  maybe('#stage')?.remove();

  await loader.finish();
  document.documentElement.dataset.boot = 'ready';
  hero.reveal();
}

/** The 3D path. */
async function boot3D(loader: Loader, hero: Hero, capabilities: Capabilities): Promise<void> {
  const canvas = maybe<HTMLCanvasElement>('#stage');
  if (!canvas) throw new Error('[boot] #stage canvas is missing from the markup');

  loader.set(STEP.chunk, 'Compiling shaders');

  // Code-split: this is the only place Three.js enters the graph.
  const { Experience } = await import('./scene/Experience');

  // Resolved by the Experience the moment a frame has actually reached the
  // screen — which is the only honest definition of "loaded" for a 3D scene.
  let onFirstFrame: () => void = () => undefined;
  const firstFrame = new Promise<void>((resolve) => {
    onFirstFrame = resolve;
  });

  const experience = new Experience({
    canvas,
    capabilities,
    onFirstFrame: () => onFirstFrame(),
    // The scene is the only thing that knows how tall the wordmark renders, so
    // it reports back and the hero's CSS positions its copy against the letters.
    onFraming: (ratio) => {
      document.documentElement.style.setProperty('--wordmark-h', `${(ratio * 100).toFixed(3)}vh`);
    },
  });

  loader.set(STEP.chunk, 'Sampling glyphs');
  await experience.init();
  loader.set(STEP.scene, 'Lighting the scene');

  experience.start();
  await firstFrame;

  loader.set(STEP.frame);
  document.documentElement.dataset.stage = 'ready';

  await loader.finish();
  document.documentElement.dataset.boot = 'ready';

  // The signature moment. The hero copy is nested into the scene's timeline so
  // the type arrives as the letterforms settle, not before.
  const intro = experience.playIntro();
  hero.reveal(intro);

  if (import.meta.env.DEV) {
    // Handy for tuning: `window.__experience.playIntro()` replays the reveal.
    Object.assign(window, { __experience: experience });
  }
}

void boot();
