/**
 * Normalised pointer with critically-damped smoothing.
 *
 * Raw pointer coordinates are far too twitchy to drive a camera. `smooth` is
 * an exponentially-eased follow of `raw`, framerate-independent, which is what
 * gives the parallax its weight. Both are in -1..1 with the origin at centre.
 *
 * Listens on `window` with passive handlers and does nothing on touch devices
 * (which take the 2D layout anyway).
 */

export interface Vec2 {
  x: number;
  y: number;
}

export class Pointer {
  readonly raw: Vec2 = { x: 0, y: 0 };
  readonly smooth: Vec2 = { x: 0, y: 0 };

  /** 0..1 — how quickly `smooth` catches up. Lower = heavier, more cinematic. */
  ease = 2.4;

  private active = false;

  constructor() {
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
  }

  /** True once the user has actually moved the pointer. */
  get engaged(): boolean {
    return this.active;
  }

  update(delta: number): void {
    // 1 - e^(-k·dt) is the frame-rate-independent form of a lerp factor.
    const k = 1 - Math.exp(-this.ease * delta);
    this.smooth.x += (this.raw.x - this.smooth.x) * k;
    this.smooth.y += (this.raw.y - this.smooth.y) * k;
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.active = true;
    this.raw.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.raw.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  private onPointerLeave = (): void => {
    // Drift back to centre when the cursor leaves the window.
    this.raw.x = 0;
    this.raw.y = 0;
  };
}
