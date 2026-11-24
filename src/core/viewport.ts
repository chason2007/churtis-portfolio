/**
 * Viewport state, shared by the scene and the UI.
 *
 * Resize is notoriously noisy on mobile (toolbar show/hide) and expensive to
 * react to (render-target reallocation), so it is debounced to the next frame
 * and ignored when the size has not actually changed.
 */

export interface ViewportSize {
  width: number;
  height: number;
  aspect: number;
  /** devicePixelRatio already clamped to the render budget. */
  pixelRatio: number;
}

export type ResizeFn = (size: ViewportSize) => void;

export class Viewport {
  readonly size: ViewportSize;

  private callbacks = new Set<ResizeFn>();
  private pending = 0;

  constructor(private maxPixelRatio: number) {
    this.size = this.measure();
    window.addEventListener('resize', this.schedule, { passive: true });
    window.addEventListener('orientationchange', this.schedule, { passive: true });
  }

  on(fn: ResizeFn): () => void {
    this.callbacks.add(fn);
    return () => this.callbacks.delete(fn);
  }

  /** Lower the pixel-ratio cap at runtime (used by the adaptive perf guard). */
  setMaxPixelRatio(value: number): void {
    if (value === this.maxPixelRatio) return;
    this.maxPixelRatio = value;
    this.apply(this.measure());
  }

  dispose(): void {
    if (this.pending) cancelAnimationFrame(this.pending);
    this.callbacks.clear();
    window.removeEventListener('resize', this.schedule);
    window.removeEventListener('orientationchange', this.schedule);
  }

  private measure(): ViewportSize {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      aspect: width / Math.max(height, 1),
      pixelRatio: Math.min(window.devicePixelRatio || 1, this.maxPixelRatio),
    };
  }

  private schedule = (): void => {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      this.apply(this.measure());
    });
  };

  private apply(next: ViewportSize): void {
    const changed =
      next.width !== this.size.width ||
      next.height !== this.size.height ||
      next.pixelRatio !== this.size.pixelRatio;
    if (!changed) return;

    Object.assign(this.size, next);
    for (const fn of this.callbacks) fn(this.size);
  }
}
