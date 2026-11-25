import * as THREE from 'three';
import gsap from 'gsap';

import { Composer } from './post/Composer';
import { CameraRig } from './CameraRig';
import { createRenderer } from './renderer';
import { DustField } from './objects/DustField';
import { NameField } from './objects/NameField';
import { ZoneField } from './objects/ZoneField';
import { ensureFont } from './objects/textSampler';
import { buildPath, buildZones, HERO_DISTANCE, type CameraPath } from './path';
import { Disposer } from '../core/dispose';
import { Pointer } from '../core/pointer';
import { Ticker } from '../core/ticker';
import { Viewport } from '../core/viewport';
import { PerfGuard, StatsReadout } from '../core/perf';
import { getTheme } from '../content/theme';
import { site } from '../content/site';
import type { Capabilities } from '../core/capabilities';

/**
 * The 3D experience.
 *
 * Owns the renderer, the scene graph, the single render loop and every GPU
 * resource. Lazily imported from `main.ts`, so devices that take the 2D layout
 * never download Three.js at all.
 *
 * Lifecycle: `new Experience()` -> `await init()` -> `start()` -> `playIntro()`,
 * with `setScroll(t)` driving the camera along the path thereafter.
 * `dispose()` releases everything, including the GL context.
 */

export interface ExperienceOptions {
  canvas: HTMLCanvasElement;
  capabilities: Capabilities;
  /** Called once, after the very first frame has actually reached the screen. */
  onFirstFrame?: () => void;
  /**
   * Called after init and on every resize with the share of the viewport height
   * the wordmark's letterforms occupy (0-1). The hero CSS uses it to sit its
   * copy exactly against the letters — see `--wordmark-h`.
   */
  onFraming?: (wordmarkHeightRatio: number) => void;
}

/** Wordmark width in world units. The camera FOV is derived from this. */
const NAME_WORLD_WIDTH = 11.5;
/** How much world width stays in frame: the wordmark plus breathing room. */
const FRAME_WORLD_WIDTH = NAME_WORLD_WIDTH * 1.32;
/** Extra distance the camera starts back at, for the push-in on reveal. */
const INTRO_PUSH = 4.2;

/** Aperture (circle-of-confusion gain) at rest, and wide open for the rack. */
const APERTURE_SHARP = 1.5;
const APERTURE_OPEN = 4.6;

/** Bloom strength at rest, and the over-exposed flash it settles down from. */
const BLOOM_REST = 0.5;
const BLOOM_FLASH = 1.9;

/** Display face used for the particle wordmark. Must match `--font-display`. */
const DISPLAY_FONT = 'Archivo';
const DISPLAY_WEIGHT = 800;

/**
 * How much of the gap to the next zone a structure stays visible across.
 * Below 1 the zones never overlap; above it they cross-fade. 0.9 gives a brief
 * moment where the outgoing zone is still dissolving as the next assembles.
 */
const ZONE_WINDOW = 0.9;

/** Share of the first path segment over which the wordmark blows apart. */
const HERO_EXIT = 0.55;

/** Pixel-ratio ceiling after the first quality downgrade. */
const DEGRADED_PIXEL_RATIO = 1.25;
/** Share of the original instance count kept after the third downgrade. */
const DEGRADED_DENSITY = 0.55;

export class Experience {
  readonly scene = new THREE.Scene();
  readonly ticker: Ticker;
  readonly viewport: Viewport;
  readonly pointer: Pointer;

  private readonly disposer = new Disposer();
  private readonly capabilities: Capabilities;
  private readonly canvas: HTMLCanvasElement;
  private readonly onFirstFrame?: () => void;
  private readonly onFraming?: (ratio: number) => void;

  private renderer!: THREE.WebGLRenderer;
  private rig!: CameraRig;
  private composer!: Composer;
  private nameField!: NameField;
  private dustField!: DustField;
  private path!: CameraPath;
  private zoneFields: ZoneField[] = [];

  private firstFrameSent = false;

  /**
   * When the visitor asked for less motion, the scene still renders in full —
   * it just stops moving on its own. Everything that remains is driven
   * directly by the scroll position.
   */
  private readonly reducedMotion: boolean;

  private readonly perf: PerfGuard;
  private readonly stats: StatsReadout | null;

  /** Position on the camera path, 0-1. Written by the scroll driver. */
  private scrollT = 0;

  /**
   * Intro push-in, applied as an *offset* on top of the path position rather
   * than by writing the dolly directly — otherwise the per-frame path update
   * would fight the intro tween for the same property.
   */
  private readonly introOffset = new THREE.Vector3(0, 0, INTRO_PUSH);

  /**
   * Lens state, tweened by the intro and read every frame. Kept on the instance
   * so the render loop stays the single place that pushes focus into shaders.
   */
  private lens = { aperture: APERTURE_SHARP };

  private readonly pathPoint = new THREE.Vector3();
  private readonly cameraWorld = new THREE.Vector3();

  constructor({ canvas, capabilities, onFirstFrame, onFraming }: ExperienceOptions) {
    this.canvas = canvas;
    this.capabilities = capabilities;
    this.onFirstFrame = onFirstFrame;
    this.onFraming = onFraming;
    this.reducedMotion = capabilities.reducedMotion;

    // Created eagerly so `main.ts` can hang the scroll driver off the same
    // loop before the scene finishes building. One rAF for the whole app.
    this.viewport = this.disposer.add(new Viewport(capabilities.budget.maxPixelRatio));
    this.pointer = this.disposer.add(new Pointer());
    this.ticker = this.disposer.add(new Ticker());

    this.perf = new PerfGuard({ onDowngrade: this.onDowngrade });

    // `?stats` prints a frame-time readout. Useful for checking the budget on
    // a real machine rather than trusting the capability guess.
    this.stats = new URLSearchParams(window.location.search).has('stats')
      ? this.disposer.add(new StatsReadout())
      : null;
  }

  /**
   * Step quality down when the device cannot hold the frame budget.
   *
   * Ordered by how much each buys relative to how much it costs visually:
   * pixel ratio is by far the biggest fill-rate lever and the least visible on
   * a soft-edged scene, bloom is the most expensive single pass, and thinning
   * the fields is last because it is the one change you can actually see.
   */
  private onDowngrade = (level: number): void => {
    switch (level) {
      case 1:
        this.viewport.setMaxPixelRatio(Math.min(this.viewport.size.pixelRatio, DEGRADED_PIXEL_RATIO));
        break;
      case 2:
        this.composer.setBloomStrength(0);
        break;
      case 3: {
        const { budget } = this.capabilities;
        this.nameField.setCount(Math.round(budget.nameParticles * DEGRADED_DENSITY));
        this.dustField.setCount(Math.round(budget.dustParticles * DEGRADED_DENSITY));
        for (const field of this.zoneFields) {
          field.setCount(Math.round(budget.zoneParticles * DEGRADED_DENSITY));
        }
        break;
      }
      default:
        break;
    }

    console.info(`[perf] frame budget missed — quality stepped down to level ${level}`);
  };

  async init(): Promise<void> {
    const theme = getTheme();
    const { budget } = this.capabilities;

    // The wordmark is rasterised from the same woff2 the HTML uses, so the face
    // has to be resident before we sample it.
    await ensureFont(DISPLAY_FONT, DISPLAY_WEIGHT);

    this.scene.background = new THREE.Color(theme.bg);

    this.renderer = createRenderer(this.canvas, this.viewport.size, budget, theme);
    this.disposer.add(() => {
      this.renderer.dispose();
      // Drop the GL context explicitly so the GPU process reclaims it even if
      // the canvas element outlives this object.
      this.renderer.forceContextLoss();
    });

    this.path = buildPath(buildZones());

    this.rig = new CameraRig({ size: this.viewport.size });
    this.rig.frameWidth(FRAME_WORLD_WIDTH, HERO_DISTANCE);

    if (this.reducedMotion) {
      // Both are autonomous: the float moves with no input at all, and the
      // parallax keeps gliding after the pointer has stopped.
      this.rig.idleAmplitude = 0;
      this.rig.parallax.set(0, 0);
    }
    this.scene.add(this.rig.dolly);

    this.nameField = this.disposer.add(
      new NameField({
        lines: [site.hero.name],
        fontFamily: DISPLAY_FONT,
        fontWeight: DISPLAY_WEIGHT,
        count: budget.nameParticles,
        worldWidth: NAME_WORLD_WIDTH,
        theme,
      }),
    );
    this.scene.add(this.nameField.object);

    this.dustField = this.disposer.add(
      new DustField({
        count: budget.dustParticles,
        volume: new THREE.Vector3(26, 16, 34),
        opacity: 0.5,
        theme,
      }),
    );
    this.scene.add(this.dustField.object);

    this.buildZoneFields(theme);

    this.composer = this.disposer.add(
      new Composer({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.rig.camera,
        size: this.viewport.size,
        budget,
      }),
    );

    // Start black and wide open; the intro timeline fades the frame up and
    // racks the lens into focus.
    this.composer.setExposure(0);
    this.composer.setBloomStrength(BLOOM_FLASH);
    this.lens.aperture = APERTURE_OPEN;

    // Place the camera before the first frame so nothing is rendered from the
    // scene's default position.
    this.applyPath();

    this.disposer.add(this.viewport.on(this.onResize));
    this.disposer.add(this.ticker.add(this.onTick));

    this.onFraming?.(this.wordmarkHeightRatio());
  }

  start(): void {
    this.ticker.start();
  }

  /** Move the camera along the path. `t` is 0-1, from the scroll driver. */
  setScroll(t: number): void {
    this.scrollT = THREE.MathUtils.clamp(t, 0, 1);
  }

  /**
   * Share of the viewport height taken up by the wordmark's letterforms.
   *
   * Derived from the camera's actual vertical frustum at the wordmark's
   * distance and the sampled glyph bounds, so it stays correct through every
   * FOV change the responsive framing makes.
   */
  wordmarkHeightRatio(): number {
    const frameHeight =
      2 * HERO_DISTANCE * Math.tan(THREE.MathUtils.degToRad(this.rig.camera.fov) / 2);
    return this.nameField.sample.inkHeight / frameHeight;
  }

  /**
   * The signature moment.
   *
   * Four things move together, deliberately on slightly different curves and
   * durations so the frame keeps settling after the letters land:
   *
   *   1. the frame fades up from black
   *   2. the particle cloud crystallises into the wordmark
   *   3. the camera pushes in
   *   4. the lens racks from wide-open to sharp while the bloom flash decays
   *
   * Returns the timeline so the UI can hang the headline's own reveal off it.
   */
  playIntro(): gsap.core.Timeline {
    const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });

    if (this.reducedMotion) {
      // Cut straight to the settled frame. Still a timeline, so callers that
      // nest things into it do not have to branch.
      this.composer.setExposure(1);
      this.composer.setBloomStrength(BLOOM_REST);
      this.introOffset.z = 0;
      this.nameField.progress = 1;
      this.lens.aperture = APERTURE_SHARP;
      return timeline;
    }

    // Tweened through proxy objects so the Composer keeps a narrow API and
    // nothing outside this class pokes at uniforms directly.
    const exposure = { value: 0 };
    const bloom = { strength: BLOOM_FLASH };

    timeline
      .to(
        exposure,
        {
          value: 1,
          duration: 1.4,
          ease: 'power2.inOut',
          onUpdate: () => this.composer.setExposure(exposure.value),
        },
        0,
      )
      .to(this.introOffset, { z: 0, duration: 3.6, ease: 'power2.out' }, 0)
      .to(
        bloom,
        {
          strength: BLOOM_REST,
          duration: 3.2,
          ease: 'power2.out',
          onUpdate: () => this.composer.setBloomStrength(bloom.strength),
        },
        0.2,
      )
      .to(this.nameField, { progress: 1, duration: 3.1, ease: 'power3.inOut' }, 0.15)
      .to(this.lens, { aperture: APERTURE_SHARP, duration: 2.9, ease: 'power2.inOut' }, 0.3);

    return timeline;
  }

  dispose(): void {
    gsap.killTweensOf([this.nameField, this.lens, this.introOffset]);
    this.disposer.run();
    this.scene.clear();
  }

  /** One instanced field per stop on the path that has a structure. */
  private buildZoneFields(theme: ReturnType<typeof getTheme>): void {
    const { budget } = this.capabilities;

    for (const zone of this.path.zones) {
      if (!zone.shape || !zone.shapePosition) continue;

      const field = this.disposer.add(
        new ZoneField({
          kind: zone.shape,
          count: budget.zoneParticles,
          scale: zone.shapeScale ?? 3.5,
          position: zone.shapePosition,
          theme,
        }),
      );

      this.zoneFields.push(field);
      this.scene.add(field.object);
    }
  }

  /** Place the camera and set every zone's reveal from the scroll position. */
  private applyPath(): void {
    const t = this.scrollT;

    this.path.position.getPoint(t, this.pathPoint);
    this.rig.dolly.position.copy(this.pathPoint).add(this.introOffset);

    this.path.target.getPoint(t, this.rig.target);

    // The wordmark blows apart over the first part of the opening segment —
    // well before the About zone assembles, so the two never overlap.
    this.nameField.dissolve = THREE.MathUtils.smoothstep(t, 0, this.path.step * HERO_EXIT);

    // Zones fade in and out by proximity in path parameter. Anything far enough
    // away is set to 0, which takes it out of the render list entirely.
    const window = this.path.step * ZONE_WINDOW;
    let fieldIndex = 0;

    for (let i = 0; i < this.path.zones.length; i += 1) {
      const zone = this.path.zones[i];
      if (!zone.shape) continue;

      const distance = Math.abs(t - this.path.parameterFor(i)) / window;
      this.zoneFields[fieldIndex].reveal = 1 - THREE.MathUtils.smoothstep(distance, 0, 1);
      fieldIndex += 1;
    }
  }

  private onResize = (): void => {
    const { size } = this.viewport;
    this.renderer.setPixelRatio(size.pixelRatio);
    this.renderer.setSize(size.width, size.height, false);
    this.rig.resize(size);
    this.composer.resize(size);
    this.onFraming?.(this.wordmarkHeightRatio());
  };

  private onTick = (delta: number, elapsed: number): void => {
    this.pointer.update(delta);
    this.applyPath();
    this.rig.update(elapsed, this.pointer.smooth);

    // Every autonomous movement in the shaders — drift, swirl, twinkle, the
    // dust's slow fall — is a function of this clock. Freezing it stops all of
    // them at once, with no shader changes and no per-effect flags, while the
    // scroll-driven assembly and camera path keep working normally.
    const sceneTime = this.reducedMotion ? 0 : elapsed;
    const spin = this.reducedMotion ? 0 : delta;

    // One place writes focus into the shaders, every frame, whatever moved it.
    const focus = this.rig.focusDistance;
    const { x, y } = this.pointer.smooth;

    this.nameField.setFocus(focus, this.lens.aperture);
    this.nameField.update(sceneTime, x, y);

    this.rig.camera.getWorldPosition(this.cameraWorld);
    this.dustField.setFocus(focus, this.lens.aperture);
    this.dustField.update(sceneTime, x, y, this.cameraWorld);

    for (const field of this.zoneFields) {
      field.setFocus(focus, this.lens.aperture);
      field.update(spin, sceneTime, x, y);
    }

    this.composer.render(delta, elapsed);

    this.perf.sample(delta);
    this.stats?.update(delta, this.perf, ` · ${this.capabilities.tier}`);

    if (!this.firstFrameSent) {
      this.firstFrameSent = true;
      this.onFirstFrame?.();
    }
  };
}
