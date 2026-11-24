import * as THREE from 'three';
import gsap from 'gsap';

import { Composer } from './post/Composer';
import { CameraRig } from './CameraRig';
import { createRenderer } from './renderer';
import { DustField } from './objects/DustField';
import { NameField } from './objects/NameField';
import { ensureFont } from './objects/textSampler';
import { Disposer } from '../core/dispose';
import { Pointer } from '../core/pointer';
import { Ticker } from '../core/ticker';
import { Viewport } from '../core/viewport';
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
 * Lifecycle: `new Experience()` -> `await init()` -> `start()` -> `playIntro()`.
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
/** Resting camera distance from the wordmark plane. */
const HERO_DISTANCE = 9;
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

export class Experience {
  readonly scene = new THREE.Scene();

  private readonly disposer = new Disposer();
  private readonly capabilities: Capabilities;
  private readonly canvas: HTMLCanvasElement;
  private readonly onFirstFrame?: () => void;
  private readonly onFraming?: (ratio: number) => void;

  private renderer!: THREE.WebGLRenderer;
  private viewport!: Viewport;
  private rig!: CameraRig;
  private composer!: Composer;
  private pointer!: Pointer;
  private ticker!: Ticker;
  private nameField!: NameField;
  private dustField!: DustField;

  private firstFrameSent = false;

  /**
   * Lens state, tweened by the intro and read every frame. Kept on the instance
   * rather than inside the timeline so the render loop stays the single place
   * that pushes focus into the shaders.
   */
  private lens = { aperture: APERTURE_SHARP };

  constructor({ canvas, capabilities, onFirstFrame, onFraming }: ExperienceOptions) {
    this.canvas = canvas;
    this.capabilities = capabilities;
    this.onFirstFrame = onFirstFrame;
    this.onFraming = onFraming;
  }

  async init(): Promise<void> {
    const theme = getTheme();
    const { budget } = this.capabilities;

    // The wordmark is rasterised from the same woff2 the HTML uses, so the face
    // has to be resident before we sample it.
    await ensureFont(DISPLAY_FONT, DISPLAY_WEIGHT);

    this.viewport = this.disposer.add(new Viewport(budget.maxPixelRatio));
    this.pointer = this.disposer.add(new Pointer());
    this.ticker = this.disposer.add(new Ticker());

    this.scene.background = new THREE.Color(theme.bg);

    this.renderer = createRenderer(this.canvas, this.viewport.size, budget, theme);
    this.disposer.add(() => {
      this.renderer.dispose();
      // Drop the GL context explicitly so the GPU process reclaims it even if
      // the canvas element outlives this object.
      this.renderer.forceContextLoss();
    });

    this.rig = new CameraRig({ size: this.viewport.size });
    this.rig.frameWidth(FRAME_WORLD_WIDTH, HERO_DISTANCE);
    this.rig.dolly.position.set(0, 0, HERO_DISTANCE + INTRO_PUSH);
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
        volume: new THREE.Vector3(26, 15, 60),
        opacity: 0.5,
        theme,
      }),
    );
    this.scene.add(this.dustField.object);

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

    this.disposer.add(this.viewport.on(this.onResize));
    this.disposer.add(this.ticker.add(this.onTick));

    this.onFraming?.(this.wordmarkHeightRatio());
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

  start(): void {
    this.ticker.start();
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
      .to(this.rig.dolly.position, { z: HERO_DISTANCE, duration: 3.6, ease: 'power2.out' }, 0)
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
    gsap.killTweensOf([this.nameField, this.lens]);
    if (this.rig) gsap.killTweensOf(this.rig.dolly.position);
    this.disposer.run();
    this.scene.clear();
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
    this.rig.update(elapsed, this.pointer.smooth);

    // One place writes focus into the shaders, every frame, whatever moved it.
    const focus = this.rig.focusDistance;
    this.nameField.setFocus(focus, this.lens.aperture);
    this.dustField.setFocus(focus, this.lens.aperture);

    this.nameField.update(elapsed, this.pointer.smooth.x, this.pointer.smooth.y);
    this.dustField.update(elapsed, this.pointer.smooth.x, this.pointer.smooth.y);

    this.composer.render(delta, elapsed);

    if (!this.firstFrameSent) {
      this.firstFrameSent = true;
      this.onFirstFrame?.();
    }
  };
}
