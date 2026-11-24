import gsap from 'gsap';
import { site } from '../content/site';
import { all, el, maybe } from './dom';

/**
 * Hero UI.
 *
 * Owns the HTML half of the signature moment: the calls to action (rendered
 * from `site.hero.ctas`) and the entrance animation that brings the copy in
 * around the particle wordmark.
 *
 * The reveal is handed the scene's intro timeline so the two are a single
 * synchronised sequence rather than two animations that happen to overlap.
 */

export interface HeroOptions {
  /** Skip all motion and show the final state immediately. */
  reducedMotion: boolean;
}

export class Hero {
  private readonly reducedMotion: boolean;
  private readonly revealTargets: HTMLElement[];

  constructor({ reducedMotion }: HeroOptions) {
    this.reducedMotion = reducedMotion;

    this.renderCtas();

    // Ordered by `data-reveal-order` so the stagger follows the design's
    // reading order rather than document order.
    this.revealTargets = all('[data-reveal]').sort(
      (a, b) => Number(a.dataset.revealOrder ?? 0) - Number(b.dataset.revealOrder ?? 0),
    );
  }

  /**
   * Bring the hero copy in.
   *
   * @param parent   The scene's intro timeline, if there is one. The copy is
   *                 nested into it so both halves share one clock.
   * @param position Offset within the parent, in seconds.
   */
  reveal(parent?: gsap.core.Timeline, position = 1.5): gsap.core.Timeline {
    const timeline = gsap.timeline();

    if (this.reducedMotion) {
      // No motion: set the final state in one go. Still a timeline, so callers
      // do not need to branch.
      timeline.set(this.revealTargets, { opacity: 1, y: 0, clearProps: 'willChange' });
      return timeline;
    }

    timeline.fromTo(
      this.revealTargets,
      { opacity: 0, y: 18, filter: 'blur(6px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 1.15,
        ease: 'power3.out',
        stagger: 0.14,
        // Drop the compositor hint once the elements have landed.
        clearProps: 'willChange,filter',
      },
    );

    if (parent) parent.add(timeline, position);
    return timeline;
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
