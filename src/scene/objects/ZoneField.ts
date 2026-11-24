import * as THREE from 'three';
import { resolveIncludes } from '../../shaders/glsl';
import vertexSource from '../../shaders/zoneField.vert.glsl?raw';
import fragmentSource from '../../shaders/zoneField.frag.glsl?raw';
import { buildShape, type ShapeKind } from './shapes';
import type { Theme } from '../../content/theme';

/**
 * The structure that marks a stop on the camera path.
 *
 * One instanced draw call per zone, same technique as the hero's name field.
 * Assembly is driven by `reveal`, which the scroll system sets from the
 * camera's proximity — so a zone that is nowhere near the camera costs nothing
 * but a `visible = false`.
 */

export interface ZoneFieldOptions {
  kind: ShapeKind;
  count: number;
  /** Overall size in world units. */
  scale: number;
  /** Where the structure sits on the path. */
  position: THREE.Vector3;
  /** Radians per second about Y. Slow — this should barely register. */
  spin?: number;
  theme: Theme;
}

export class ZoneField {
  readonly object: THREE.Mesh;
  readonly radius: number;

  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly spin: number;

  /** Instances allocated at construction — the ceiling for setCount(). */
  private maxCount = 0;

  private revealValue = 0;

  constructor({ kind, count, scale, position, spin = 0.035, theme }: ZoneFieldOptions) {
    const shape = buildShape(kind, count, scale);
    this.radius = shape.radius;
    this.spin = spin;

    const base = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;
    this.geometry.instanceCount = count;
    this.maxCount = count;

    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const o = i * 3;
      seeds[o] = Math.random();          // assembly stagger
      seeds[o + 1] = Math.random();      // size / colour variance
      seeds[o + 2] = Math.random() * 10; // drift phase
    }

    this.geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(shape.positions, 3));
    this.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: resolveIncludes(vertexSource),
      fragmentShader: resolveIncludes(fragmentSource),
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uSize: { value: scale * 0.011 },
        // Far dimmer than the hero wordmark on purpose: a zone is scenery
        // behind the copy, and the name stays the brightest thing on the site.
        uIntensity: { value: 0.42 },
        uFocus: { value: 12 },
        uAperture: { value: 1.5 },
        uScatter: { value: 1.1 },
        uDrift: { value: scale * 0.02 },
        uPointer: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(theme.ink) },
        uColorAccent: { value: new THREE.Color(theme.accent) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.name = `ZoneField:${kind}`;
    this.object.position.copy(position);
    this.object.frustumCulled = false;
    // Hidden until the camera gets close enough to be worth drawing.
    this.object.visible = false;
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  /**
   * 0 = scattered and invisible, 1 = fully assembled.
   * Setting it to 0 also takes the mesh out of the render list entirely, which
   * is what keeps a six-zone scene as cheap as a one-zone scene.
   */
  get reveal(): number {
    return this.revealValue;
  }
  set reveal(value: number) {
    this.revealValue = value;
    this.material.uniforms.uReveal.value = value;
    this.object.visible = value > 0.001;
  }

  /**
   * Thin the field at runtime.
   *
   * `instanceCount` is just a draw-call parameter, so this costs nothing and
   * reallocates nothing — the attribute buffers stay exactly as they are and
   * the GPU simply draws fewer of them.
   */
  setCount(count: number): void {
    this.geometry.instanceCount = Math.max(0, Math.min(count, this.maxCount));
  }

  setFocus(distance: number, aperture?: number): void {
    this.material.uniforms.uFocus.value = distance;
    if (aperture !== undefined) this.material.uniforms.uAperture.value = aperture;
  }

  update(delta: number, elapsed: number, pointerX: number, pointerY: number): void {
    if (!this.object.visible) return;

    this.object.rotation.y += this.spin * delta;

    const u = this.material.uniforms;
    u.uTime.value = elapsed;
    (u.uPointer.value as THREE.Vector2).set(pointerX, pointerY);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.object.removeFromParent();
  }
}
