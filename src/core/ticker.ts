/**
 * The single requestAnimationFrame loop.
 *
 * One loop for the whole app: nothing else should call requestAnimationFrame
 * for per-frame work. It stops rendering entirely when the tab is hidden
 * (saving battery and GPU) and clamps delta so a long stall can't teleport
 * animations on the first frame back.
 */

export type TickFn = (delta: number, elapsed: number) => void;

/** 100ms. Longer gaps are treated as a resume, not real elapsed time. */
const MAX_DELTA = 0.1;

export class Ticker {
  private callbacks = new Set<TickFn>();
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private running = false;
  private disposed = false;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange, { passive: true });
  }

  add(fn: TickFn): () => void {
    this.callbacks.add(fn);
    return () => this.callbacks.delete(fn);
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.callbacks.clear();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Seconds since start(), excluding hidden time. */
  get time(): number {
    return this.elapsed;
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.loop);

    const delta = Math.min((now - this.last) / 1000, MAX_DELTA);
    this.last = now;
    this.elapsed += delta;

    for (const fn of this.callbacks) fn(delta, this.elapsed);
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };
}
