import gsap from 'gsap';

/**
 * The hero copy's entrance.
 *
 * Split into its own module purely so GSAP stays off the critical path: this
 * is dynamically imported, and only when motion is actually wanted. A visitor
 * with reduced motion never downloads it, and in the flat layout it is the only
 * thing that pulls GSAP in at all.
 */

export type HeroReveal = (parent?: gsap.core.Timeline, position?: number) => gsap.core.Timeline;

export function createHeroReveal(targets: HTMLElement[]): HeroReveal {
  return (parent, position = 0.55) => {
    const timeline = gsap.timeline();

    timeline.fromTo(
      targets,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        // Drop the compositor hint once the elements have landed.
        clearProps: 'willChange',
      },
    );

    // Nested into the scene's intro timeline when there is one, so the type
    // arrives as the letterforms settle rather than on its own clock.
    if (parent) parent.add(timeline, position);
    return timeline;
  };
}
