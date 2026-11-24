import type { OutlineEntry } from '../content/outline';
import { el, must } from './dom';

/**
 * The quick nav.
 *
 * A fixed rail of ticks down the right edge. Every section — including every
 * project — is one click away from anywhere on the page, which is the whole
 * point: a recruiter must never be trapped inside the scroll cinematic to
 * reach the work.
 *
 * Labels are always in the accessibility tree and always focusable; they are
 * only hidden *visually* until the rail is hovered or something inside it takes
 * focus, so the resting state stays quiet without costing anything.
 *
 * Navigation is delegated so the smooth-scroll driver can own the movement —
 * a raw anchor jump fights Lenis for the scroll position.
 */

export interface NavOptions {
  outline: OutlineEntry[];
  /** Called with a section id instead of letting the anchor navigate. */
  onNavigate: (id: string) => void;
}

export class Nav {
  private readonly outline: OutlineEntry[];
  private readonly onNavigate: (id: string) => void;

  /** Nav links, keyed by section id. */
  private readonly links = new Map<string, HTMLAnchorElement>();

  private activeId: string | null = null;

  constructor({ outline, onNavigate }: NavOptions) {
    this.outline = outline;
    this.onNavigate = onNavigate;
  }

  mount(): void {
    const root = must('#rail');
    const entries = this.outline.filter((entry) => entry.inNav);

    const items = entries.map((entry) => {
      const link = el(
        'a',
        {
          class: 'rail__link',
          href: `#${entry.id}`,
          'data-kind': entry.kind,
        },
        [
          el('span', { class: 'rail__label' }, [
            ...(entry.index ? [el('span', { class: 'rail__index numeric' }, [entry.index])] : []),
            el('span', {}, [entry.navLabel]),
          ]),
          el('span', { class: 'rail__tick', 'aria-hidden': 'true' }),
        ],
      ) as HTMLAnchorElement;

      link.addEventListener('click', (event) => {
        // Let modified clicks (new tab, download…) behave normally.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        this.onNavigate(entry.id);
        // Keep the URL shareable without triggering the browser's own jump.
        history.replaceState(null, '', `#${entry.id}`);
      });

      this.links.set(entry.id, link);
      return el('li', { class: 'rail__item' }, [link]);
    });

    root.replaceChildren(el('ul', { class: 'rail__list' }, items));
  }

  /** Mark one section as current. Idempotent — safe to call every frame. */
  setActive(id: string): void {
    if (id === this.activeId) return;

    if (this.activeId) {
      this.links.get(this.activeId)?.removeAttribute('aria-current');
    }

    // The hero has no nav entry, so nothing is current while it is on screen.
    this.links.get(id)?.setAttribute('aria-current', 'true');
    this.activeId = this.links.has(id) ? id : null;
  }

  dispose(): void {
    this.links.clear();
  }
}
