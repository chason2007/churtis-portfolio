import { site } from '../content/site';
import { all } from './dom';

/**
 * Binds `content/site.ts` into the static markup.
 *
 * Any element carrying `data-content="hero.tagline"` has its text replaced with
 * the value at that path in `site`; `data-content-list="contact.locations"`
 * does the same for an array of strings, joined with a middle dot.
 *
 * The markup keeps the real copy inline so the page is crawlable and paints
 * correctly before the bundle runs; this pass makes `site.ts` the authority,
 * and warns in development when the two have drifted apart so the duplication
 * can never go stale silently.
 */

/** Separator for list bindings. Matches the one used throughout the copy. */
const LIST_SEPARATOR = ' · ';

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

/**
 * Warn when the inline markup and `site.ts` have drifted apart.
 *
 * Development only. In production `site.ts` simply wins, silently.
 */
function warnOnDrift(path: string, markup: string, source: string): void {
  if (!import.meta.env.DEV) return;
  if (normalise(markup) === normalise(source)) return;

  console.warn(
    `[content] index.html and site.ts disagree on "${path}".\n` +
      `  markup:  ${normalise(markup)}\n` +
      `  site.ts: ${source}\n` +
      '  site.ts wins. Update index.html to match so the pre-JS paint is correct.',
  );
}

export function applyContent(root: ParentNode = document): void {
  for (const node of all('[data-content-list]', root)) {
    const path = node.dataset.contentList;
    if (!path) continue;

    const value = resolvePath(path);
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      console.warn(`[content] "${path}" is not a string array in site.ts — leaving the markup alone`);
      continue;
    }

    const joined = value.join(LIST_SEPARATOR);
    warnOnDrift(path, node.textContent ?? '', joined);
    node.textContent = joined;
  }

  for (const node of all('[data-content]', root)) {
    const path = node.dataset.content;
    if (!path) continue;

    const value = resolvePath(path);
    if (typeof value !== 'string') {
      console.warn(`[content] "${path}" is not a string in site.ts — leaving the markup alone`);
      continue;
    }

    warnOnDrift(path, node.textContent ?? '', value);
    node.textContent = value;
  }
}
