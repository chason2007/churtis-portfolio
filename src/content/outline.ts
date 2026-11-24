import { site } from './site';

/**
 * The site's outline: the ordered list of stops, derived from the content.
 *
 * This is the shared spine between the three things that have to agree on what
 * the page contains — the HTML sections, the nav rail, and the 3D camera path.
 * Add a project to `site.ts` and all three gain an entry.
 *
 * Deliberately free of any Three.js import: the UI needs this list, and the UI
 * must not drag the 3D bundle in behind it. `scene/path.ts` takes these entries
 * and attaches the world-space geometry.
 */

export type ZoneKind = 'hero' | 'about' | 'project' | 'skills' | 'contact';

export interface OutlineEntry {
  /** DOM anchor id — the section element and the nav link both use it. */
  id: string;
  kind: ZoneKind;
  /** Short label for the nav rail. */
  navLabel: string;
  /** Two-digit index for projects; undefined elsewhere. */
  index?: string;
  /**
   * Which side of the frame this section's copy sits on. Zones alternate sides
   * as the camera travels, and the copy always takes the side opposite the
   * structure the camera is flying towards.
   */
  textSide: 'left' | 'right';
  /** Whether the nav rail lists this stop. */
  inNav: boolean;
}

/**
 * Which side of the centre line a zone's structure sits on: -1 or +1.
 * Shared with the camera path so the layout and the copy cannot disagree.
 */
export function laneFor(index: number): number {
  return index % 2 === 0 ? -1 : 1;
}

export function buildOutline(): OutlineEntry[] {
  const stops: Array<Omit<OutlineEntry, 'textSide'>> = [
    { id: 'hero', kind: 'hero', navLabel: 'Top', inNav: true },
    { id: 'about', kind: 'about', navLabel: 'About', inNav: true },
    ...site.projects.map((project) => ({
      id: project.id,
      kind: 'project' as const,
      navLabel: project.title,
      index: project.index,
      inNav: true,
    })),
    { id: 'skills', kind: 'skills', navLabel: 'Skills', inNav: true },
    { id: 'contact', kind: 'contact', navLabel: 'Contact', inNav: true },
  ];

  return stops.map((stop, i) => ({
    ...stop,
    // Structure on the right of frame (lane > 0) means the copy goes left.
    textSide: stop.kind === 'hero' ? 'left' : laneFor(i) > 0 ? 'left' : 'right',
  }));
}
