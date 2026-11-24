import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { resolveIncludes } from '../../shaders/glsl';
import compositeVert from '../../shaders/composite.vert.glsl?raw';
import compositeFrag from '../../shaders/composite.frag.glsl?raw';
import type { RenderBudget } from '../../core/capabilities';
import type { ViewportSize } from '../../core/viewport';

/**
 * Post-processing chain.
 *
 *   RenderPass → [UnrealBloomPass] → OutputPass → CompositePass → screen
 *
 * Order matters. `OutputPass` is where tone mapping and the linear→sRGB
 * conversion happen, so bloom runs *before* it (on HDR values, which is the
 * only place a bloom threshold means anything) and grain/vignette run *after*
 * it, in display space, where film grain actually behaves like film grain.
 *
 * Depth of field is intentionally absent from this chain — it is computed
 * per-particle in the vertex shaders instead. See the note in nameField.vert.glsl.
 *
 * The internal targets are half-float so the additive highlights survive the
 * trip to the bloom pass without clipping.
 */

export interface ComposerOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  size: ViewportSize;
  budget: RenderBudget;
}

export class Composer {
  readonly composer: EffectComposer;

  private readonly target: THREE.WebGLRenderTarget;
  private readonly renderPass: RenderPass;
  private readonly bloomPass: UnrealBloomPass | null = null;
  private readonly outputPass: OutputPass;
  private readonly compositePass: ShaderPass;
  private readonly budget: RenderBudget;

  constructor({ renderer, scene, camera, size, budget }: ComposerOptions) {
    this.budget = budget;

    const width = Math.max(1, Math.floor(size.width * size.pixelRatio));
    const height = Math.max(1, Math.floor(size.height * size.pixelRatio));

    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      samples: budget.msaa,
      depthBuffer: true,
      stencilBuffer: false,
    });

    this.composer = new EffectComposer(renderer, this.target);
    this.composer.setPixelRatio(size.pixelRatio);
    this.composer.setSize(size.width, size.height);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    if (budget.bloom) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(
          Math.max(1, width / budget.bloomDivisor),
          Math.max(1, height / budget.bloomDivisor),
        ),
        // strength, radius, threshold — restrained on purpose. Bloom should
        // make the glyph strokes glow, not wash the frame out.
        0.5,
        0.62,
        0.3,
      );
      this.composer.addPass(this.bloomPass);
    }

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.compositePass = new ShaderPass({
      name: 'CompositePass',
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uGrain: { value: budget.grain ? 0.055 : 0 },
        uVignette: { value: 0.85 },
        uAberration: { value: 1.6 },
        uExposure: { value: 1.0 },
      },
      vertexShader: resolveIncludes(compositeVert),
      fragmentShader: resolveIncludes(compositeFrag),
    });
    this.compositePass.renderToScreen = true;
    this.composer.addPass(this.compositePass);
  }

  /** Swap the camera the chain renders with (used when the path forks). */
  setCamera(camera: THREE.Camera): void {
    this.renderPass.camera = camera;
  }

  /** Fade the whole frame — used for the loading hand-off and section wipes. */
  setExposure(value: number): void {
    this.compositePass.uniforms.uExposure.value = value;
  }

  setBloomStrength(value: number): void {
    if (this.bloomPass) this.bloomPass.strength = value;
  }

  resize(size: ViewportSize): void {
    const width = Math.max(1, Math.floor(size.width * size.pixelRatio));
    const height = Math.max(1, Math.floor(size.height * size.pixelRatio));

    this.composer.setPixelRatio(size.pixelRatio);
    this.composer.setSize(size.width, size.height);

    this.bloomPass?.setSize(
      Math.max(1, width / this.budget.bloomDivisor),
      Math.max(1, height / this.budget.bloomDivisor),
    );
    (this.compositePass.uniforms.uResolution.value as THREE.Vector2).set(width, height);
  }

  render(delta: number, elapsed: number): void {
    this.compositePass.uniforms.uTime.value = elapsed;
    this.composer.render(delta);
  }

  dispose(): void {
    this.bloomPass?.dispose();
    this.outputPass.dispose();
    this.compositePass.dispose();
    this.renderPass.dispose();
    this.composer.dispose();
    this.target.dispose();
  }
}
