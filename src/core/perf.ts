/**
 * Adaptive quality.
 *
 * The capability check picks a render budget from what the device *says* it
 * is. That is a guess: an 8-core laptop can still be on integrated graphics,
 * throttled, on battery, or driving a 5K display. This watches what the device
 * actually delivers and steps the quality down if it cannot hold the target.
 *
 * Deliberately one-way. Quality never steps back up: oscillating between two
 * settings is far more noticeable than sitting at the lower one, and the
 * conditions that caused a downgrade (thermals, another tab, a plugged-in
 * monitor) rarely reverse within a page view.
 */

export interface PerfGuardOptions {
  /** Frames averaged before a verdict. ~1s at 60fps. */
  sampleSize?: number;
  /** Average frame time above which quality steps down, in ms. */
  budgetMs?: number;
  /**
   * Frames ignored at startup. The first frames include shader compilation and
   * buffer uploads, and the intro that follows is the heaviest moment in the
   * whole scene — full particle counts, a wide-open aperture inflating every
   * sprite, and the bloom flash. Judging on those would downgrade every device.
   */
  warmupFrames?: number;
  /**
   * Consecutive over-budget windows required before stepping down. One bad
   * second is usually something else: a GC pause, a tab coming back to the
   * foreground, a screen recording, the compositor catching up after a resize.
   */
  strikes?: number;
  /** How many times quality may step down. */
  maxLevel?: number;
  /** Called with the new level, 1-based. */
  onDowngrade: (level: number) => void;
}

/** 55fps. Below this on a 60Hz display the motion starts to read as uneven. */
const DEFAULT_BUDGET_MS = 1000 / 55;

export class PerfGuard {
  private readonly sampleSize: number;
  private readonly budgetMs: number;
  private readonly maxLevel: number;
  private readonly requiredStrikes: number;
  private readonly onDowngrade: (level: number) => void;

  private warmup: number;
  private total = 0;
  private frames = 0;
  private level = 0;
  private strikes = 0;

  /** Rolling average frame time in ms, from the last completed window. */
  private lastAverage = 0;

  constructor({
    sampleSize = 60,
    budgetMs = DEFAULT_BUDGET_MS,
    // ~5s at 60fps: past the intro, which is the scene's heaviest moment.
    warmupFrames = 300,
    strikes = 2,
    maxLevel = 3,
    onDowngrade,
  }: PerfGuardOptions) {
    this.sampleSize = sampleSize;
    this.budgetMs = budgetMs;
    this.warmup = warmupFrames;
    this.requiredStrikes = Math.max(1, strikes);
    this.maxLevel = maxLevel;
    this.onDowngrade = onDowngrade;
  }

  /** Frames per second over the last completed window, or 0 before the first. */
  get fps(): number {
    return this.lastAverage > 0 ? 1000 / this.lastAverage : 0;
  }

  get currentLevel(): number {
    return this.level;
  }

  /** True until enough frames have been seen to say anything useful. */
  get warmingUp(): boolean {
    return this.warmup > 0 || this.lastAverage === 0;
  }

  /** Feed one frame's delta, in seconds. */
  sample(delta: number): void {
    if (this.warmup > 0) {
      this.warmup -= 1;
      return;
    }

    const ms = delta * 1000;
    // A single enormous frame is a stall (a GC pause, a tab switch, the user
    // dragging the window), not a signal about sustained capability.
    if (ms > 200) return;

    this.total += ms;
    this.frames += 1;

    if (this.frames < this.sampleSize) return;

    this.lastAverage = this.total / this.frames;
    this.total = 0;
    this.frames = 0;

    if (this.lastAverage <= this.budgetMs) {
      // A good window clears the record — only *sustained* trouble counts.
      this.strikes = 0;
      return;
    }

    this.strikes += 1;
    if (this.strikes < this.requiredStrikes || this.level >= this.maxLevel) return;

    this.strikes = 0;
    this.level += 1;
    this.onDowngrade(this.level);
  }
}

/**
 * A minimal frame-time readout, shown with `?stats`.
 *
 * Intentionally not a dependency — a stats library is several KB for a number
 * this project already computes. Updates four times a second so the digits are
 * readable rather than a blur.
 */
export class StatsReadout {
  private readonly element: HTMLElement;
  private elapsed = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'stats';
    this.element.setAttribute('aria-hidden', 'true');
    document.body.append(this.element);
  }

  update(delta: number, guard: PerfGuard, extra = ''): void {
    this.elapsed += delta;
    if (this.elapsed < 0.25) return;
    this.elapsed = 0;

    if (guard.warmingUp) {
      // Saying "0 fps" while the first frames are still compiling shaders is
      // worse than saying nothing.
      this.element.textContent = `warming up · q${guard.currentLevel}${extra}`;
      this.element.dataset.state = 'warm';
      return;
    }

    const fps = guard.fps;
    this.element.textContent = `${fps.toFixed(0)} fps · q${guard.currentLevel}${extra}`;
    this.element.dataset.state = fps >= 50 ? 'good' : fps >= 30 ? 'fair' : 'poor';
  }

  dispose(): void {
    this.element.remove();
  }
}
