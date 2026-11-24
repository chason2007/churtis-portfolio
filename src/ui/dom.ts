/** Small, typed DOM helpers. Nothing clever — just removes the casting noise. */

/** Query one element, or throw. Use for nodes the markup guarantees. */
export function must<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`[dom] required element not found: ${selector}`);
  return node;
}

/** Query one element, or null. Use for nodes added in a later build step. */
export function maybe<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selector);
}

export function all<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Create an element with attributes and children in one expression. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

/** Promise that settles after `ms`. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
