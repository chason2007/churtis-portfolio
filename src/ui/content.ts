import { site } from '../content/site';
import { all } from './dom';

/**
 * Binds `content/site.ts` into the static markup.
 *
 * Any element carrying `data-content="hero.tagline"` has its text replaced with
 * the value at that path in `site`. The markup keeps the real copy inline so
 * the page is crawlable and paints correctly before the bundle runs; this pass
 * makes `site.ts` the authority, and warns in development when the two have
 * drifted apart so the duplication can never go stale silently.
 */

function resolvePath(path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, site as unknown);
}

/** Collapse whitespace so markup indentation does not count as a difference. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function applyContent(root: ParentNode = document): void {
  for (const node of all('[data-content]', root)) {
    const path = node.dataset.content;
    if (!path) continue;

    const value = resolvePath(path);
    if (typeof value !== 'string') {
      console.warn(`[content] "${path}" is not a string in site.ts — leaving the markup alone`);
      continue;
    }

    if (import.meta.env.DEV && normalise(node.textContent ?? '') !== normalise(value)) {
      console.warn(
        `[content] index.html and site.ts disagree on "${path}".\n` +
          `  markup:  ${normalise(node.textContent ?? '')}\n` +
          `  site.ts: ${normalise(value)}\n` +
          '  site.ts wins. Update index.html to match so the pre-JS paint is correct.',
      );
    }

    node.textContent = value;
  }
}
