import * as THREE from 'three';
import type { RenderBudget } from '../core/capabilities';
import type { ViewportSize } from '../core/viewport';
import type { Theme } from '../content/theme';

/**
 * Renderer construction, in one place.
 *
 * Notable choices:
 *  - `antialias: false`. Everything in this scene is a soft-edged additive
 *    sprite, so MSAA has no edges to resolve and only costs bandwidth. The
 *    composite pass's dither handles the only visible artefact (dark banding).
 *  - ACES tone mapping. The scene is additive and routinely exceeds 1.0 in the
 *    glyph strokes; ACES rolls that off to a filmic white instead of clipping
 *    to flat magenta-ish grey.
 *  - `alpha: false` + an opaque clear colour: lets the compositor skip blending
 *    the canvas against the page.
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  size: ViewportSize,
  budget: RenderBudget,
  theme: Theme,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: budget.msaa > 0,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    // The scene never reads back pixels, so let the driver discard the buffer.
    preserveDrawingBuffer: false,
  });

  renderer.setPixelRatio(size.pixelRatio);
  renderer.setSize(size.width, size.height, false);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  renderer.setClearColor(new THREE.Color(theme.bg), 1);
  renderer.autoClear = true;

  // No shadow maps anywhere in this scene — make sure nothing turns them on.
  renderer.shadowMap.enabled = false;

  return renderer;
}
