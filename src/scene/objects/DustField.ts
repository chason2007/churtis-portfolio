import * as THREE from 'three';
import { resolveIncludes } from '../../shaders/glsl';
import vertexSource from '../../shaders/dust.vert.glsl?raw';
import fragmentSource from '../../shaders/dust.frag.glsl?raw';
import type { Theme } from '../../content/theme';

/**
 * Ambient haze.
 *
 * Its job is scale: without something between the camera and the wordmark, the
 * parallax has nothing to read against and the void looks like a flat backdrop.
 * Deliberately dim and heavily defocused — if you can pick out individual motes
 * it is too strong.
 *
 * The field tiles infinitely around the camera (see the shader), so the camera
 * can fly the whole path without leaving the haze and without a single position
 * being recomputed on the CPU.
 */

export interface DustFieldOptions {
  count: number;
  /** Half-extents of the volume in world units. */
  volume: THREE.Vector3;
  opacity: number;
  theme: Theme;
}

export class DustField {
  readonly object: THREE.Mesh;

  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;

  constructor({ count, volume, opacity, theme }: DustFieldOptions) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;
    this.geometry.instanceCount = count;

    const offsets = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const o = i * 3;
      offsets[o] = (Math.random() * 2 - 1) * volume.x;
      offsets[o + 1] = (Math.random() * 2 - 1) * volume.y;
      // Uniform in Z: the shader tiles the volume around the camera, so any
      // bias here would travel with it and read as a moving clump.
      offsets[o + 2] = (Math.random() * 2 - 1) * volume.z;

      seeds[o] = 0.25 + Math.random() * 0.75; // brightness
      seeds[o + 1] = Math.random();           // size / fall speed
      seeds[o + 2] = Math.random() * 10;       // phase
    }

    this.geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    this.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: resolveIncludes(vertexSource),
      fragmentShader: resolveIncludes(fragmentSource),
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.03 },
        uFocus: { value: 9 },
        uAperture: { value: 1.35 },
        uVolume: { value: volume.clone() },
        uOrigin: { value: new THREE.Vector3() },
        uOpacity: { value: opacity },
        uPointer: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(theme.inkDim) },
        uColorAccent: { value: new THREE.Color(theme.accent) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.name = 'DustField';
    this.object.frustumCulled = false;
    this.object.matrixAutoUpdate = false;
    this.object.updateMatrix();
  }

  setFocus(distance: number, aperture?: number): void {
    this.material.uniforms.uFocus.value = distance;
    if (aperture !== undefined) this.material.uniforms.uAperture.value = aperture;
  }

  setOpacity(value: number): void {
    this.material.uniforms.uOpacity.value = value;
  }

  update(elapsed: number, pointerX: number, pointerY: number, origin: THREE.Vector3): void {
    const u = this.material.uniforms;
    u.uTime.value = elapsed;
    (u.uPointer.value as THREE.Vector2).set(pointerX, pointerY);
    (u.uOrigin.value as THREE.Vector3).copy(origin);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.object.removeFromParent();
  }
}
