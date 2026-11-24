import * as THREE from 'three';

/**
 * Resource disposal.
 *
 * WebGL resources are not garbage collected — geometries, materials, textures
 * and render targets must be released explicitly. Every object this app creates
 * is registered with a `Disposer`, so tearing the experience down (e.g. when
 * switching to the 2D fallback after a resize, or on hot reload) leaves no
 * GPU memory behind.
 */

interface Disposable {
  dispose(): void;
}

export class Disposer {
  private items: Array<Disposable | (() => void)> = [];

  /** Track a Three.js resource, or any teardown closure. */
  add<T extends Disposable | (() => void)>(item: T): T {
    this.items.push(item);
    return item;
  }

  /** Dispose in reverse order of registration, swallowing individual failures. */
  run(): void {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      try {
        if (typeof item === 'function') item();
        else item.dispose();
      } catch (error) {
        console.warn('[dispose] failed to release a resource', error);
      }
    }
    this.items.length = 0;
  }
}

/**
 * Walk an Object3D tree and dispose every geometry, material and texture.
 * Safe to call on shared resources only once — prefer `Disposer` for those.
 */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as Partial<THREE.Mesh>;
    mesh.geometry?.dispose();

    const material = mesh.material;
    if (!material) return;

    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) disposeMaterial(mat);
  });

  root.removeFromParent();
}

function disposeMaterial(material: THREE.Material): void {
  // Release any texture held in a uniform or a standard material slot.
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) value.dispose();
  }

  const shader = material as Partial<THREE.ShaderMaterial>;
  if (shader.uniforms) {
    for (const uniform of Object.values(shader.uniforms)) {
      if (uniform?.value instanceof THREE.Texture) uniform.value.dispose();
    }
  }

  material.dispose();
}
