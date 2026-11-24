import { el } from './dom';

/**
 * Custom cursor.
 *
 * A dot that tracks exactly and a ring that lags behind it. The lag is a CSS
 * transition on `transform`, not a per-frame lerp: it runs on the compositor,
 * costs no main-thread work, and cannot drift out of sync with anything.
 *
 * Only mounts for a fine pointer — a touch device has no cursor to replace.
 * Reduced motion keeps the cursor but loses the lag (see controls.css): a
 * shape that tracks the pointer exactly is not motion, but a ring that drifts
 * along behind it is, and that is the part the preference is about.
 */

/** Selector for things the cursor should react to. */
const INTERACTIVE = 'a, button, [role="button"], input, textarea, select, summary';

export class Cursor {
  private root: HTMLElement | null = null;
  private dot: HTMLElement | null = null;
  private ring: HTMLElement | null = null;
  private mounted = false;

  /** True when this device has a pointer worth replacing. */
  static supported(): boolean {
    return window.matchMedia('(pointer: fine)').matches;
  }

  mount(): void {
    if (this.mounted || !Cursor.supported()) return;
    this.mounted = true;

    this.dot = el('span', { class: 'cursor__dot' });
    this.ring = el('span', { class: 'cursor__ring' });
    this.root = el('div', { class: 'cursor', 'aria-hidden': 'true' }, [this.ring, this.dot]);

    document.body.append(this.root);
    document.documentElement.dataset.cursor = 'on';

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    // The cursor must not be left stranded mid-screen when the pointer leaves.
    document.addEventListener('pointerleave', this.onLeave, { passive: true });
    document.addEventListener('pointerenter', this.onEnter, { passive: true });
    // `pointerover` bubbles, so one listener covers every element, including
    // ones added later.
    document.addEventListener('pointerover', this.onPointerOver, { passive: true });
    document.addEventListener('pointerout', this.onPointerOut, { passive: true });
  }

  dispose(): void {
    if (!this.mounted) return;
    this.mounted = false;

    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointerleave', this.onLeave);
    document.removeEventListener('pointerenter', this.onEnter);
    document.removeEventListener('pointerover', this.onPointerOver);
    document.removeEventListener('pointerout', this.onPointerOut);

    this.root?.remove();
    delete document.documentElement.dataset.cursor;
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;

    // Writing a custom property rather than the transform itself lets the dot
    // and the ring share one position while keeping their own scale.
    const transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    if (this.dot) this.dot.style.transform = transform;
    if (this.ring) this.ring.style.transform = transform;

    if (this.root?.dataset.visible !== 'true') {
      this.root?.setAttribute('data-visible', 'true');
    }
  };

  private onPointerOver = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.closest?.(INTERACTIVE)) this.root?.setAttribute('data-hot', 'true');
  };

  private onPointerOut = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.closest?.(INTERACTIVE)) this.root?.removeAttribute('data-hot');
  };

  private onPointerDown = (): void => this.root?.setAttribute('data-down', 'true');
  private onPointerUp = (): void => this.root?.removeAttribute('data-down');
  private onLeave = (): void => this.root?.removeAttribute('data-visible');
  private onEnter = (): void => this.root?.setAttribute('data-visible', 'true');
}
