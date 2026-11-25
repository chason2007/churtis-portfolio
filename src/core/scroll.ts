import type Lenis from 'lenis';

/**
 * The scroll driver.
 *
 * Turns document scroll into a position on the camera path, and tells the rest
 * of the app which zone is active.
 *
 * The mapping is anchored to the DOM rather than to a fraction of the document
 * height: each section's *centre* is pinned to its zone's control point, and
 * the path parameter is interpolated between them. That means sections can be
 * any height they need to be — a project with more copy can be taller — without
 * the camera and the copy drifting out of sync.
 *
 * Smooth scrolling (Lenis) is opt-in via `enableSmooth()`, which fetches the
 * library on demand — so a reduced-motion visitor never downloads a
 * smooth-scrolling library, and the flat layout does not pay for one it will
 * not use. Without it, the browser's own scrolling is left alone.
 */

export interface ScrollState {
  /** Path parameter, 0-1. Feed straight to the camera curves. */
  t: number;
  /** Index of the zone the camera has most recently passed. */
  index: number;
  /** 0-1 between zone `index` and the next one. */
  frac: number;
  /**
   * Index of the *nearest* zone — `index` rounded by `frac`.
   *
   * This, not `index`, is what "the section you are looking at" means: anchors
   * are section centres, so halfway between two of them the next one is already
   * filling the viewport. The nav and the `data-zone` attribute use it.
   */
  nearest: number;
  /** Raw document progress, 0-1. */
  progress: number;
  /** Pixels per second, signed. Used for motion-reactive effects. */
  velocity: number;
}

export type ScrollListener = (state: ScrollState) => void;

export interface ScrollDriverOptions {
  /** Section elements, in the same order as the zones. */
  sections: HTMLElement[];
}

export class ScrollDriver {
  readonly state: ScrollState = { t: 0, index: 0, frac: 0, nearest: 0, progress: 0, velocity: 0 };

  private readonly sections: HTMLElement[];
  private readonly listeners = new Set<ScrollListener>();
  private lenis: Lenis | null = null;

  /** Document-space centre of each section, recomputed on resize. */
  private anchors: number[] = [];
  private resizeFrame = 0;
  private lastScroll = 0;
  private disposed = false;

  constructor({ sections }: ScrollDriverOptions) {
    this.sections = sections;

    this.measure();
    this.lastScroll = window.scrollY;

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.scheduleMeasure, { passive: true });

    this.recompute(0);
  }

  /**
   * Fetch Lenis and take over the scroll. Safe to call once; a failure leaves
   * native scrolling in place, which is a degraded experience rather than a
   * broken one.
   */
  async enableSmooth(): Promise<void> {
    if (this.lenis || this.disposed) return;

    try {
      const { default: Lenis } = await import('lenis');
      this.lenis = new Lenis({
        // Smooth enough to read as a camera flight without lagging behind wheel input.
        duration: 0.68,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        smoothWheel: true,
        wheelMultiplier: 1.05,
        touchMultiplier: 1.6,
      });
      this.lenis.resize();
    } catch (error) {
      console.warn('[scroll] smooth scrolling unavailable — falling back to native', error);
    }
  }

  on(fn: ScrollListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Advance the smooth-scroll integrator. Driven by the app's single rAF loop,
   * not by one of its own. No-op when smooth scrolling is off.
   */
  raf(timeMs: number): void {
    this.lenis?.raf(timeMs);
  }

  /** Called every frame so velocity decays even when no scroll event fires. */
  update(delta: number): void {
    this.recompute(delta);
  }

  /** Jump to a section by its anchor id. */
  scrollTo(id: string, opts: { immediate?: boolean } = {}): void {
    const element = document.getElementById(id);
    if (!element) return;

    // When Lenis is running it owns the scroll position: a native
    // scrollIntoView gets overwritten by its next integration step, which lands
    // the page somewhere else entirely. Route *both* jump kinds through it.
    if (this.lenis) {
      this.lenis.scrollTo(element, opts.immediate ? { immediate: true } : { duration: 0.85 });
      return;
    }

    element.scrollIntoView({
      behavior: opts.immediate ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  /** Re-measure after the DOM changes height (new sections, font swap…). */
  refresh(): void {
    this.measure();
    this.lenis?.resize();
    this.recompute(0);
  }

  dispose(): void {
    this.disposed = true;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.scheduleMeasure);
    this.listeners.clear();
    this.lenis?.destroy();
  }

  private measure(): void {
    const top = window.scrollY;
    this.anchors = this.sections.map((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top + top + rect.height / 2;
    });
  }

  private scheduleMeasure = (): void => {
    if (this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.refresh();
    });
  };

  private onScroll = (): void => {
    this.recompute(0);
  };

  private recompute(delta: number): void {
    const scroll = window.scrollY;
    const viewport = window.innerHeight;

    // The reference line is the middle of the viewport: a section is "arrived"
    // when its centre crosses it.
    const reference = scroll + viewport / 2;

    const n = this.anchors.length;
    let index = 0;
    let frac = 0;

    if (n >= 2) {
      if (reference <= this.anchors[0]) {
        index = 0;
        frac = 0;
      } else if (reference >= this.anchors[n - 1]) {
        index = n - 1;
        frac = 0;
      } else {
        // Sections are in document order, so a linear scan is correct and, at
        // this list length, faster than anything cleverer.
        for (let i = 0; i < n - 1; i += 1) {
          if (reference >= this.anchors[i] && reference < this.anchors[i + 1]) {
            const span = Math.max(this.anchors[i + 1] - this.anchors[i], 1);
            index = i;
            frac = (reference - this.anchors[i]) / span;
            break;
          }
        }
      }
    }

    const scrollable = Math.max(document.documentElement.scrollHeight - viewport, 1);

    this.state.t = n >= 2 ? (index + frac) / (n - 1) : 0;
    this.state.index = index;
    this.state.frac = frac;
    this.state.nearest = Math.min(index + (frac >= 0.5 ? 1 : 0), Math.max(n - 1, 0));
    this.state.progress = Math.min(Math.max(scroll / scrollable, 0), 1);
    this.state.velocity = delta > 0 ? (scroll - this.lastScroll) / delta : 0;
    this.lastScroll = scroll;

    for (const fn of this.listeners) fn(this.state);
  }
}
