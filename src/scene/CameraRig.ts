import * as THREE from 'three';
import type { ViewportSize } from '../core/viewport';
import type { Vec2 } from '../core/pointer';

/**
 * Camera rig.
 *
 * The camera lives inside a `dolly` group. The dolly owns *where we are on the
 * path* (the scroll system moves it in step 3); the camera owns the small, fast
 * stuff — mouse parallax and an idle float. Separating them means scroll and
 * parallax can never fight each other.
 *
 * `frameWidth()` derives the field of view from how much world width must stay
 * on screen, so the wordmark fits any window shape without magic numbers.
 */

export interface CameraRigOptions {
  size: ViewportSize;
  near?: number;
  far?: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly dolly: THREE.Group;

  /** World-space point the camera aims at. */
  readonly target = new THREE.Vector3(0, 0, 0);

  /** Parallax travel in world units at full pointer deflection. */
  parallax = new THREE.Vector2(0.55, 0.32);
  /** Amplitude of the idle breathing float, world units. */
  idleAmplitude = 0.075;

  /** Horizontal world width the camera must keep in frame. */
  private framedWidth = 0;
  private framedDistance = 1;

  private readonly worldTarget = new THREE.Vector3();

  constructor({ size, near = 0.1, far = 220 }: CameraRigOptions) {
    this.camera = new THREE.PerspectiveCamera(45, size.aspect, near, far);
    this.dolly = new THREE.Group();
    this.dolly.name = 'CameraDolly';
    this.dolly.add(this.camera);
  }

  /**
   * Keep `width` world units horizontally in frame from `distance` away.
   * Re-applied on every resize, which is what makes the hero responsive.
   */
  frameWidth(width: number, distance: number): void {
    this.framedWidth = width;
    this.framedDistance = distance;
    this.applyFov();
  }

  resize(size: ViewportSize): void {
    this.camera.aspect = size.aspect;
    if (this.framedWidth > 0) this.applyFov();
    else this.camera.updateProjectionMatrix();
  }

  /** Distance from the camera to the focus target — feeds the shader DOF. */
  get focusDistance(): number {
    this.camera.getWorldPosition(this.worldTarget);
    return this.worldTarget.distanceTo(this.target);
  }

  update(elapsed: number, pointer: Vec2): void {
    // Parallax is applied in the camera's local space, i.e. relative to
    // wherever the dolly currently sits on the path.
    const floatX = Math.sin(elapsed * 0.21) * this.idleAmplitude;
    const floatY = Math.cos(elapsed * 0.17) * this.idleAmplitude * 0.7;

    this.camera.position.set(
      pointer.x * this.parallax.x + floatX,
      -pointer.y * this.parallax.y + floatY,
      0,
    );

    // lookAt needs world space, and the dolly's matrix may have just moved.
    this.dolly.updateMatrixWorld();
    this.camera.lookAt(this.target);
  }

  private applyFov(): void {
    const halfH = Math.atan(this.framedWidth / 2 / this.framedDistance);
    const vFovRad = 2 * Math.atan(Math.tan(halfH) / Math.max(this.camera.aspect, 0.0001));
    // Clamp: below ~26deg the perspective goes flat, above ~78deg it distorts.
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFovRad), 26, 78);
    this.camera.updateProjectionMatrix();
  }
}
