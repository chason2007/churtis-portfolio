/**
 * Theme bridge.
 *
 * The palette's single source of truth is `src/styles/tokens.css`. This module
 * reads those CSS custom properties at boot so the WebGL scene and the HTML UI
 * can never drift apart — change a token, and the shaders follow.
 *
 * To recolour the site, edit `tokens.css` only. See README "Swap colours".
 */

export interface Theme {
  /** Near-black scene background / fog colour. */
  bg: string;
  /** The one restrained accent. */
  accent: string;
  /** Cooler lift used at the bright end of particle gradients. */
  accentLift: string;
  /** Off-white used for the name's core. */
  ink: string;
  /** Dim ink for ambient dust. */
  inkDim: string;
}

const FALLBACKS: Theme = {
  bg: '#050607',
  accent: '#3d6dff',
  accentLift: '#7fb2ff',
  ink: '#eef1f6',
  inkDim: '#5a6472',
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

let cached: Theme | null = null;

/** Resolve the palette from CSS. Cached — tokens are static after first paint. */
export function getTheme(): Theme {
  if (cached) return cached;
  if (typeof window === 'undefined') return FALLBACKS;

  const styles = getComputedStyle(document.documentElement);
  cached = {
    bg: readVar(styles, '--c-bg', FALLBACKS.bg),
    accent: readVar(styles, '--c-accent', FALLBACKS.accent),
    accentLift: readVar(styles, '--c-accent-lift', FALLBACKS.accentLift),
    ink: readVar(styles, '--c-ink', FALLBACKS.ink),
    inkDim: readVar(styles, '--c-ink-dim', FALLBACKS.inkDim),
  };
  return cached;
}
