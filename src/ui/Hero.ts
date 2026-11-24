import { site } from '../content/site';
import { all, el, maybe } from './dom';
import type { HeroReveal } from './heroReveal';

/**
 * Hero UI.
 *
 * Owns the HTML half of the signature moment: the calls to action (rendered
 * from `site.hero.ctas`) and the entrance animation that brings the copy in
 * around the particle wordmark.
 *
 * The animation itself lives in `heroReveal.ts` and is fetched by `prepare()`,
 * which keeps GSAP off the critical path. `prepare()` is awaited during boot so
 * the module is resident before the scene's intro timeline starts — otherwise
 * the copy would be nested into a timeline that had already passed its cue.
 */

export interface HeroOptions {
  /** Skip all motion and show the final state immediately. */
  reducedMotion: boolean;
}

export class Hero {
  private readonly reducedMotion: boolean;
  private readonly revealTargets: HTMLElement[];

  private revealFn: HeroReveal | null = null;

  constructor({ reducedMotion }: HeroOptions) {
    this.reducedMotion = reducedMotion;

    this.renderCtas();

    // Ordered by `data-reveal-order` so the stagger follows the design's
    // reading order rather than document order.
    this.revealTargets = all('[data-reveal]').sort(
      (a, b) => Number(a.dataset.revealOrder ?? 0) - Number(b.dataset.revealOrder ?? 0),
    );
  }

  /** Fetch the animation module, unless the visitor asked for less motion. */
  async prepare(): Promise<void> {
    if (this.reducedMotion) return;

    try {
      const { createHeroReveal } = await import('./heroReveal');
      this.revealFn = createHeroReveal(this.revealTargets);
    } catch (error) {
      // The copy is hidden by CSS in anticipation of being animated in. If the
      // module cannot be fetched, that CSS must be defeated or the hero would
      // be left blank — a missing animation is cosmetic, missing copy is not.
      console.error('[hero] could not load the reveal animation — showing the copy as-is', error);
      document.documentElement.dataset.revealFallback = 'on';
    }
  }

  /**
   * Bring the hero copy in.
   *
   * @param parent   The scene's intro timeline, if there is one.
   * @param position Offset within the parent, in seconds.
   */
  reveal(parent?: gsap.core.Timeline, position?: number): void {
    // Reduced motion: the copy was never hidden, so there is nothing to do.
    this.revealFn?.(parent, position);
  }

  /**
   * Replace the static CTA list with one built from `site.hero.ctas`.
   *
   * The markup in index.html carries the same links so the page is correct
   * before the bundle runs; this makes site.ts the authority and marks any
   * link still waiting on a real URL as unavailable rather than letting a
   * recruiter click through to a 404.
   */
  private renderCtas(): void {
    const list = maybe<HTMLUListElement>('#hero-ctas');
    if (!list) return;

    const items = site.hero.ctas.map((cta, index) => {
      const link = el(
        'a',
        {
          class: index === 0 ? 'cta cta--primary' : 'cta',
          href: cta.href,
          'data-placeholder': cta.placeholder ? 'true' : undefined,
          'aria-disabled': cta.placeholder ? 'true' : undefined,
          title: cta.placeholder
            ? `Not set yet — see the TODO for "${cta.label}" in src/content/site.ts`
            : undefined,
        },
        [el('span', {}, [cta.label]), el('span', { class: 'cta__arrow', 'aria-hidden': 'true' }, ['→'])],
      );

      if (cta.placeholder) {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          console.info(
            `[hero] "${cta.label}" has no URL yet. Set it in src/content/site.ts (hero.ctas).`,
          );
        });
      }

      return el('li', {}, [link]);
    });

    list.replaceChildren(...items);
  }
}
