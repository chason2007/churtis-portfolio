import { site } from '../content/site';
import type { Project } from '../content/types';
import type { OutlineEntry } from '../content/outline';
import { el, must } from './dom';

/**
 * Builds the page's content sections from `content/site.ts`.
 *
 * Everything here is real, selectable, crawlable HTML overlaid on the canvas —
 * no body copy is ever rendered into a texture. One section per zone, in the
 * same order, so the scroll driver can pin each one's centre to its point on
 * the camera path.
 *
 * `textSide` comes from the outline: the copy sits on the opposite side of the
 * frame from the structure the camera is flying towards. Nothing here imports
 * the scene, so the 2D layout costs no Three.js.
 */

export class Sections {
  /** Section elements in zone order, including the hero. */
  readonly elements: HTMLElement[] = [];

  private observer: IntersectionObserver | null = null;

  constructor(private readonly zones: OutlineEntry[]) {}

  render(): HTMLElement[] {
    const main = must('#main');
    const hero = must('#hero');

    // The hero is authored in index.html so it paints before the bundle runs;
    // everything after it is built here.
    this.elements.push(hero);

    const fragment = document.createDocumentFragment();

    for (const zone of this.zones) {
      if (zone.kind === 'hero') continue;

      const section = this.buildSection(zone);
      this.elements.push(section);
      fragment.append(section);
    }

    // Replace any previously rendered sections (hot reload, re-render).
    main.querySelectorAll('.panel').forEach((node) => node.remove());
    main.append(fragment);

    this.observeReveal();

    return this.elements;
  }

  dispose(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /**
   * Fade each panel's copy in as it arrives.
   *
   * An IntersectionObserver toggling one class, with the stagger expressed as
   * CSS transition delays — rather than a JS timeline, which would have to be
   * kept in sync with the scroll position and would run on the main thread for
   * every panel. `once` behaviour is deliberate: re-animating on the way back
   * up is distracting.
   */
  private observeReveal(): void {
    if (!('IntersectionObserver' in window)) {
      // No observer: show everything rather than hide it.
      for (const section of this.elements) section.classList.add('is-inview');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-inview');
          this.observer?.unobserve(entry.target);
        }
      },
      // Fire a little before the panel is centred, so the copy has landed by
      // the time the camera arrives at its zone.
      { rootMargin: '-15% 0px -25% 0px', threshold: 0 },
    );

    for (const section of this.elements) {
      if (section.classList.contains('hero')) continue;
      this.observer.observe(section);
    }
  }

  private buildSection(zone: OutlineEntry): HTMLElement {
    switch (zone.kind) {
      case 'about':
        return this.buildAbout(zone);
      case 'project':
        return this.buildProject(zone);
      case 'skills':
        return this.buildSkills(zone);
      case 'contact':
        return this.buildContact(zone);
      default:
        throw new Error(`[sections] no builder for zone kind "${zone.kind}"`);
    }
  }

  /** The shared outer shell: section + the offset copy column. */
  private shell(zone: OutlineEntry, modifier: string, children: Node[]): HTMLElement {
    const body = el('div', { class: 'panel__body' }, children);

    return el(
      'section',
      {
        class: `panel panel--${modifier}`,
        id: zone.id,
        'data-zone': zone.kind,
        'data-side': zone.textSide,
        'aria-labelledby': `${zone.id}-title`,
      },
      [body],
    );
  }

  private buildAbout(zone: OutlineEntry): HTMLElement {
    return this.shell(zone, 'about', [
      el('p', { class: 'panel__eyebrow label' }, [site.about.heading]),
      el('h2', { class: 'panel__title', id: `${zone.id}-title` }, [site.about.lead]),
      el(
        'div',
        { class: 'panel__copy' },
        site.about.body.map((paragraph) => el('p', {}, [paragraph])),
      ),
    ]);
  }

  private buildProject(zone: OutlineEntry): HTMLElement {
    const project = site.projects.find((p) => p.id === zone.id);
    if (!project) throw new Error(`[sections] no project matching zone "${zone.id}"`);

    const children: Node[] = [
      el('p', { class: 'panel__eyebrow label' }, [
        el('span', { class: 'numeric panel__index' }, [project.index]),
        el('span', { class: 'panel__role' }, [project.role]),
      ]),
      el('h2', { class: 'panel__title', id: `${zone.id}-title` }, [project.title]),
      el('p', { class: 'panel__subtitle' }, [project.subtitle]),
      el('p', { class: 'panel__lead' }, [project.blurb]),
      this.buildDetails(project),
      this.buildStack(project.stack),
      this.buildLinks(project.links, 'panel__links'),
    ];

    const section = this.shell(zone, 'project', children);

    // The hero's "View Work" call to action targets the first project.
    if (project.id === site.projects[0]?.id) {
      section.prepend(el('span', { id: 'work', class: 'anchor', 'aria-hidden': 'true' }));
    }

    return section;
  }

  /**
   * The project detail panel.
   *
   * A real disclosure rather than a modal: the content is always in the DOM
   * (so it is crawlable and findable with the browser's own find-in-page), the
   * button carries proper `aria-expanded` state, and nothing traps focus.
   * Headline facts — what it is, the stack, the links — stay visible, so a
   * recruiter never has to open anything to get the gist.
   */
  private buildDetails(project: Project): HTMLElement {
    const panelId = `${project.id}-details`;

    const content: Node[] = project.body.map((paragraph) => el('p', {}, [paragraph]));

    if (project.highlights?.length) {
      content.push(
        el(
          'ul',
          { class: 'highlights' },
          project.highlights.map((item) => el('li', {}, [item])),
        ),
      );
    }

    const panel = el('div', { class: 'details__panel', id: panelId, hidden: true }, content);

    const toggle = el(
      'button',
      {
        type: 'button',
        class: 'details__toggle',
        'aria-expanded': 'false',
        'aria-controls': panelId,
      },
      [
        el('span', { class: 'details__label' }, ['Details']),
        el('span', { class: 'details__sign', 'aria-hidden': 'true' }),
      ],
    );

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
      const label = toggle.querySelector('.details__label');
      if (label) label.textContent = open ? 'Details' : 'Close';
    });

    return el('div', { class: 'details' }, [toggle, panel]);
  }

  private buildStack(stack: string[]): HTMLElement {
    return el('ul', { class: 'stack', 'aria-label': 'Stack' }, [
      ...stack.map((item) => el('li', { class: 'stack__item' }, [item])),
    ]);
  }

  private buildLinks(links: Project['links'], className: string): HTMLElement {
    return el(
      'ul',
      { class: className },
      links.map((link) => {
        const external = /^https?:/.test(link.href);

        const anchor = el(
          'a',
          {
            class: 'link',
            href: link.href,
            'data-placeholder': link.placeholder ? 'true' : undefined,
            'aria-disabled': link.placeholder ? 'true' : undefined,
            title: link.placeholder
              ? `Not set yet — see the TODO for "${link.label}" in src/content/site.ts`
              : undefined,
            target: external ? '_blank' : undefined,
            rel: external ? 'noopener noreferrer' : undefined,
          },
          [
            el('span', {}, [link.label]),
            el('span', { class: 'link__arrow', 'aria-hidden': 'true' }, ['↗']),
          ],
        );

        if (link.placeholder) {
          anchor.addEventListener('click', (event) => {
            event.preventDefault();
            console.info(`[sections] "${link.label}" has no URL yet — set it in src/content/site.ts`);
          });
        }

        return el('li', {}, [anchor]);
      }),
    );
  }

  private buildSkills(zone: OutlineEntry): HTMLElement {
    const groups = site.skills.groups.map((group) =>
      el('div', { class: 'skills__group' }, [
        el('dt', { class: 'skills__label label' }, [group.label]),
        el(
          'dd',
          { class: 'skills__items' },
          group.items.map((item) => el('span', { class: 'skills__item' }, [item])),
        ),
      ]),
    );

    return this.shell(zone, 'skills', [
      // The label *is* the heading here — there is no second line of copy for
      // this section, and an invented one would be worse than none.
      el('h2', { class: 'panel__eyebrow label', id: `${zone.id}-title` }, [site.skills.heading]),
      el('dl', { class: 'skills' }, groups),
    ]);
  }

  private buildContact(zone: OutlineEntry): HTMLElement {
    return this.shell(zone, 'contact', [
      el('p', { class: 'panel__eyebrow label' }, [site.contact.heading]),
      el('h2', { class: 'panel__title', id: `${zone.id}-title` }, [site.contact.lead]),
      el('a', { class: 'contact__email', href: `mailto:${site.contact.email}` }, [
        site.contact.email,
      ]),
      el('p', { class: 'panel__note' }, [site.contact.availability]),
      this.buildLinks(site.contact.links, 'panel__links panel__links--contact'),
    ]);
  }
}
