import { maybe, wait } from './dom';

/**
 * The loading sequence.
 *
 * Driven by real milestones (fonts resident, 3D chunk fetched, scene built,
 * first frame on screen) rather than a fake timer, with one concession: a
 * minimum visible duration. Without it a warm cache finishes in 80ms and the
 * loader reads as a flash of broken layout instead of a deliberate opening.
 *
 * The markup lives in index.html so it paints before any JS runs; this class
 * only drives it, and no-ops entirely if the markup is absent.
 */

/** Below this, the sequence reads as a glitch rather than an intro. */
const MIN_VISIBLE_MS = 1150;
/** Matches the `.loader__fill` transition, so the bar lands before we leave. */
const BAR_SETTLE_MS = 440;
/** Matches the `[data-state='leaving']` transitions in loader.css. */
const LEAVE_MS = 580;
/** Matches the `.loader` opacity transition. */
const FADE_MS = 780;
/** Status word cross-fade half-cycle, matches `.loader__status`. */
const SWAP_MS = 300;

export class Loader {
  private readonly root: HTMLElement | null;
  private readonly status: HTMLElement | null;
  private readonly count: HTMLElement | null;
  private readonly fill: HTMLElement | null;

  private readonly startedAt = performance.now();

  private progress = 0;
  private displayed = 0;
  private label = '';
  private countFrame = 0;
  private finished = false;

  constructor() {
    this.root = maybe('#loader');
    this.status = maybe('#loader-status');
    this.count = maybe('#loader-count');
    this.fill = maybe('#loader-fill');

    this.label = this.status?.textContent?.trim() ?? '';
  }

  /**
   * Report progress.
   * @param progress 0-1. Never moves backwards, so out-of-order callers are safe.
   * @param label    Optional new status word; cross-faded if it changed.
   */
  set(progress: number, label?: string): void {
    if (this.finished) return;
    this.apply(progress, label);
  }

  /** The actual write. Separate so `finish()` can force the bar to 100%. */
  private apply(progress: number, label?: string): void {
    this.progress = Math.max(this.progress, Math.min(Math.max(progress, 0), 1));

    if (this.fill) {
      this.fill.style.transform = `scaleX(${this.progress})`;
    }
    this.animateCount();

    if (label !== undefined && label !== this.label) {
      this.label = label;
      void this.swapStatus(label);
    }
  }

  /**
   * Play the exit and resolve once the loader is gone.
   * Waits out the remaining minimum visible time first.
   */
  async finish(): Promise<void> {
    if (this.finished) return;
    this.finished = true;

    const remaining = MIN_VISIBLE_MS - (performance.now() - this.startedAt);
    if (remaining > 0) await wait(remaining);

    this.apply(1, 'Ready');

    // Let the bar actually reach the end before we pull the frame away.
    await wait(BAR_SETTLE_MS);

    if (!this.root) return;

    this.root.dataset.state = 'leaving';
    await wait(LEAVE_MS);

    this.root.dataset.state = 'done';
    // Out of the accessibility tree immediately; out of the DOM once the fade
    // has finished, so nothing invisible is left holding a paint layer.
    this.root.setAttribute('aria-hidden', 'true');
    this.root.removeAttribute('role');
    this.root.removeAttribute('aria-live');

    await wait(FADE_MS);
    if (this.countFrame) cancelAnimationFrame(this.countFrame);
    this.root.remove();
  }

  /**
   * Ease the displayed number towards the target instead of snapping, so a
   * jump from 40% to 100% still counts up.
   */
  private animateCount(): void {
    if (!this.count || this.countFrame) return;

    const step = (): void => {
      this.countFrame = 0;
      const target = this.progress * 100;
      this.displayed += (target - this.displayed) * 0.18;

      if (Math.abs(target - this.displayed) < 0.4) this.displayed = target;
      if (this.count) {
        this.count.textContent = String(Math.round(this.displayed)).padStart(2, '0');
      }

      if (this.displayed !== target) this.countFrame = requestAnimationFrame(step);
    };

    this.countFrame = requestAnimationFrame(step);
  }

  private async swapStatus(label: string): Promise<void> {
    if (!this.status) return;
    this.status.dataset.swap = 'out';
    await wait(SWAP_MS);
    // A later swap may have superseded this one while we waited.
    if (this.label !== label) return;
    this.status.textContent = label;
    this.status.dataset.swap = 'in';
  }
}
