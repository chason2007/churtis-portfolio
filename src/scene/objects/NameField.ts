import * as THREE from 'three';
import { resolveIncludes } from '../../shaders/glsl';
import vertexSource from '../../shaders/nameField.vert.glsl?raw';
import fragmentSource from '../../shaders/nameField.frag.glsl?raw';
import { sampleText, type TextSample } from './textSampler';
import type { Theme } from '../../content/theme';

/**
 * The hero's signature object: a cloud of instanced billboards that resolves
 * into the wordmark.
 *
 * Everything is one draw call. Position, stagger, depth of field and the exit
 * all happen on the GPU from three static instanced attributes, so the CPU cost
 * per frame is a handful of uniform writes regardless of particle count.
 */

export interface NameFieldOptions {
  /** Wordmark text, one entry per line. */
  lines: string[];
  fontFamily: string;
  fontWeight: number;
  /** Instance count — comes from the render budget, never hardcoded. */
  count: number;
  /** Width of the wordmark in world units. */
  worldWidth: number;
  theme: Theme;
}

/** How far out the scattered cloud starts, relative to the wordmark width. */
const SCATTER_SPREAD = new THREE.Vector3(0.95, 0.52, 0.62);

export class NameField {
  readonly object: THREE.Mesh;
  readonly sample: TextSample;

  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly baseGeometry: THREE.PlaneGeometry;

  constructor(options: NameFieldOptions) {
    const { lines, fontFamily, fontWeight, count, worldWidth, theme } = options;

    this.sample = sampleText({
      lines,
      fontFamily,
      fontWeight,
      tracking: -0.012,
      count,
      worldWidth,
      depth: worldWidth * 0.05,
    });

    // --- Instanced geometry.
    // A unit quad supplies `position` (-0.5..0.5) and `uv`; the vertex shader
    // billboards it in view space. One quad = 4 verts / 2 tris per particle,
    // which is cheaper on the vertex pipeline than it sounds and gives us
    // per-particle size and shape control that gl_PointSize cannot.
    this.baseGeometry = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = this.baseGeometry.index;
    this.geometry.attributes.position = this.baseGeometry.attributes.position;
    this.geometry.attributes.uv = this.baseGeometry.attributes.uv;
    this.geometry.instanceCount = count;

    const origins = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const spread = SCATTER_SPREAD.clone().multiplyScalar(worldWidth);

    for (let i = 0; i < count; i += 1) {
      const o = i * 3;

      // Uniform direction on the unit sphere (Marsaglia), then stretched into a
      // wide shallow ellipsoid so the cloud fills frame rather than reading as
      // a ball. Radius is biased outward so the centre stays readable.
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const radius = 0.4 + Math.pow(Math.random(), 0.55) * 0.6;

      origins[o] = Math.cos(phi) * s * spread.x * radius;
      origins[o + 1] = u * spread.y * radius;
      origins[o + 2] = Math.sin(phi) * s * spread.z * radius;

      seeds[o] = Math.random();           // stagger delay
      seeds[o + 1] = Math.random();       // size / brightness variance
      seeds[o + 2] = Math.random() * 10;  // drift phase
    }

    this.geometry.setAttribute('aTarget', new THREE.InstancedBufferAttribute(this.sample.positions, 3));
    this.geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 3));
    this.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: resolveIncludes(vertexSource),
      fragmentShader: resolveIncludes(fragmentSource),
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uSize: { value: worldWidth * 0.0022 },
        // Brightness per particle, and the other half of the density balance.
        //
        // The wordmark covers only ~48k screen pixels at 1440p, so a particle
        // count above ~20k is denser than the pixel grid and the field collapses
        // into flat vector type — indistinguishable from an <h1>. The look we
        // want is the opposite: comparatively few, individually bright points
        // that the eye integrates into letterforms, with the bloom pass binding
        // them together. Hence a high intensity and a modest count, not the
        // reverse. See the [textSampler] coverage log in development.
        uIntensity: { value: 0.95 },
        uFocus: { value: 9 },
        uAperture: { value: 1.5 },
        uDrift: { value: worldWidth * 0.004 },
        uPointer: { value: new THREE.Vector2() },
        uDissolve: { value: 0 },
        uColorCore: { value: new THREE.Color(theme.ink) },
        uColorAccent: { value: new THREE.Color(theme.accent) },
        uColorLift: { value: new THREE.Color(theme.accentLift) },
      },
      transparent: true,
      // Additive, no depth: the particles are emissive points in a void, so
      // there is nothing meaningful to sort against and sorting 24k instances
      // per frame would cost more than the effect is worth.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.name = 'NameField';
    // Single draw call that always fills frame — culling it can only cost time,
    // and instanced attributes are invisible to the default bounding sphere.
    this.object.frustumCulled = false;
    this.object.matrixAutoUpdate = false;
    this.object.updateMatrix();
  }

  /** 0 = scattered cloud, 1 = resolved wordmark. Tweened by the hero timeline. */
  get progress(): number {
    return this.material.uniforms.uProgress.value as number;
  }
  set progress(value: number) {
    this.material.uniforms.uProgress.value = value;
  }

  /** 0 = present, 1 = blown apart. Driven by the scroll position. */
  get dissolve(): number {
    return this.material.uniforms.uDissolve.value as number;
  }
  set dissolve(value: number) {
    this.material.uniforms.uDissolve.value = value;
    // Fully dissolved means fully transparent — stop submitting the draw call
    // for the rest of the page rather than blending 16k invisible sprites.
    this.object.visible = value < 0.999;
  }

  /** Per-particle brightness. Lower = grainier, higher = more solid. */
  setIntensity(value: number): void {
    this.material.uniforms.uIntensity.value = value;
  }

  /** Focal distance in world units — the hero keeps this on the wordmark plane. */
  setFocus(distance: number, aperture?: number): void {
    this.material.uniforms.uFocus.value = distance;
    if (aperture !== undefined) this.material.uniforms.uAperture.value = aperture;
  }

  update(elapsed: number, pointerX: number, pointerY: number): void {
    const u = this.material.uniforms;
    u.uTime.value = elapsed;
    (u.uPointer.value as THREE.Vector2).set(pointerX, pointerY);
  }

  dispose(): void {
    // Note: `baseGeometry`'s attributes are shared with `geometry`, so the
    // instanced geometry owns them now — disposing both would double-free.
    this.geometry.dispose();
    this.material.dispose();
    this.object.removeFromParent();
  }
}
