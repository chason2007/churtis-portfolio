/**
 * Text → point cloud.
 *
 * Rasterises the wordmark to an offscreen 2D canvas once, reads back the glyph
 * coverage, and returns an evenly-distributed set of world-space positions
 * inside the letterforms. Those become the resting targets of the hero's
 * instanced particles.
 *
 * Why rasterise rather than use TextGeometry / an SVG path?
 *   - It needs no extra font format (we already self-host the woff2 the page uses,
 *     so the particles match the HTML type exactly).
 *   - Coverage sampling gives a uniform *area* distribution, which is what makes
 *     thick strokes read as solid and thin ones as delicate. Outline sampling does not.
 *   - It costs one canvas readback at boot, then nothing per frame.
 *
 * Letter tracking is applied by hand rather than via `ctx.letterSpacing`, which
 * is still inconsistently supported — and tracking on the wordmark is load-bearing
 * for how expensive the type looks.
 */

export interface TextSampleOptions {
  /** One entry per line. */
  lines: string[];
  fontFamily: string;
  fontWeight: number;
  /** Letter tracking in em. Negative tightens — good for large display caps. */
  tracking?: number;
  /** Line height as a multiple of the font size. */
  lineHeight?: number;
  /** How many points to return. Upsampled with jitter if the glyphs give fewer. */
  count: number;
  /** Width of the resulting cloud in world units. */
  worldWidth: number;
  /** Thickness of the slab in world units — gives the wordmark depth for the DOF. */
  depth?: number;
  /** Positional jitter in world units, breaks up the pixel grid. */
  jitter?: number;
  /** Alpha threshold (0-255) for treating a pixel as ink. */
  threshold?: number;
}

export interface TextSample {
  /** Flat xyz triples, length = count * 3. Centred on the origin. */
  positions: Float32Array;
  count: number;
  /** Width / height of the sampled canvas, in world units. */
  aspect: number;
  worldWidth: number;
  worldHeight: number;
  /**
   * Tight bounding box of the actual glyph coverage, in world units — i.e. the
   * cap height and width of the letterforms, excluding the canvas padding.
   * The hero uses this to place its HTML copy exactly against the letters.
   */
  inkWidth: number;
  inkHeight: number;
}

/** Raster width. 1024 keeps crisp glyph sampling at 4x lower CPU/readback cost. */
const CANVAS_WIDTH = 1024;
/** Font size used for measurement before scaling to fit CANVAS_WIDTH. */
const MEASURE_SIZE = 200;
/** Horizontal padding as a fraction of the canvas, so glyphs never clip. */
const PADDING = 0.03;

function fontString(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

/** Width of a string with manual tracking applied. */
function measureTracked(ctx: CanvasRenderingContext2D, text: string, trackingPx: number): number {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width;
  return width + trackingPx * Math.max(text.length - 1, 0);
}

/** Draw a string centred on `cx`, one glyph at a time, with manual tracking. */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  trackingPx: number,
): void {
  const width = measureTracked(ctx, text, trackingPx);
  let x = cx - width / 2;
  for (const char of text) {
    ctx.fillText(char, x, y);
    x += ctx.measureText(char).width + trackingPx;
  }
}

/**
 * Ensure the font is actually available to the canvas before rasterising.
 * Without this the first sample silently falls back to a system font.
 */
export async function ensureFont(family: string, weight: number): Promise<void> {
  if (!('fonts' in document)) return;
  const descriptor = fontString(weight, MEASURE_SIZE, `"${family}"`);
  if (document.fonts.check(descriptor)) return;
  try {
    await document.fonts.load(descriptor);
    await document.fonts.ready;
  } catch {
    // A missing font is a visual regression, not a crash — carry on with the fallback.
    console.warn(`[textSampler] could not preload "${family}" — sampling may use a fallback face`);
  }
}

export function sampleText(options: TextSampleOptions): TextSample {
  const {
    lines,
    fontFamily,
    fontWeight,
    tracking = -0.01,
    lineHeight = 1.06,
    count,
    worldWidth,
    depth = 0.45,
    jitter = 0,
    threshold = 96,
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('[textSampler] 2D context unavailable');

  const family = `"${fontFamily}", system-ui, sans-serif`;

  // --- Pass 1: measure at a reference size, then scale to fill the canvas width.
  ctx.font = fontString(fontWeight, MEASURE_SIZE, family);
  const refTracking = tracking * MEASURE_SIZE;
  const refWidth = Math.max(...lines.map((line) => measureTracked(ctx, line, refTracking)), 1);

  const usableWidth = CANVAS_WIDTH * (1 - PADDING * 2);
  const fontSize = (MEASURE_SIZE * usableWidth) / refWidth;
  const trackingPx = tracking * fontSize;

  // Cap height drives the visual height; using it (rather than the em box) keeps
  // the all-caps wordmark optically centred.
  ctx.font = fontString(fontWeight, fontSize, family);
  const metrics = ctx.measureText('H');
  const capHeight = metrics.actualBoundingBoxAscent || fontSize * 0.72;
  const lineStep = fontSize * lineHeight;

  const blockHeight = capHeight + lineStep * (lines.length - 1);
  const canvasHeight = Math.ceil(blockHeight + fontSize * 0.3);

  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;

  // Canvas state resets with the size change — re-apply.
  ctx.font = fontString(fontWeight, fontSize, family);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.clearRect(0, 0, canvas.width, canvasHeight);

  const top = (canvasHeight - blockHeight) / 2;
  lines.forEach((line, i) => {
    drawTracked(ctx, line, CANVAS_WIDTH / 2, top + capHeight + lineStep * i, trackingPx);
  });

  // --- Pass 2: collect every inked pixel.
  const { data } = ctx.getImageData(0, 0, CANVAS_WIDTH, canvasHeight);
  const ink: number[] = [];

  // Track the tight glyph bounds while we are already walking every pixel.
  let minX = CANVAS_WIDTH;
  let maxX = 0;
  let minY = canvasHeight;
  let maxY = 0;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= threshold) continue;
    const index = (i - 3) / 4;
    ink.push(index);

    const x = index % CANVAS_WIDTH;
    const y = (index - x) / CANVAS_WIDTH;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (ink.length === 0) {
    throw new Error('[textSampler] no glyph coverage — is the font loaded?');
  }

  if (import.meta.env.DEV) {
    // Handy when tuning density: particle count vs. available coverage is what
    // decides whether the wordmark reads as grain, as type, or as mush.
    console.info(
      `[textSampler] "${lines.join(' / ')}" — ${ink.length} ink px, ` +
        `${count} particles (1 per ${(ink.length / count).toFixed(1)} px), ` +
        `font ${fontSize.toFixed(0)}px, canvas ${CANVAS_WIDTH}x${canvasHeight}`,
    );
  }

  // --- Pass 3: shuffle so taking a prefix is an unbiased uniform sample.
  // Partial Fisher-Yates: only the first `count` slots need to be settled.
  const take = Math.min(count, ink.length);
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(Math.random() * (ink.length - i));
    const tmp = ink[i];
    ink[i] = ink[j];
    ink[j] = tmp;
  }

  // --- Pass 4: map pixels to world space.
  const scale = worldWidth / CANVAS_WIDTH;
  const worldHeight = canvasHeight * scale;
  const positions = new Float32Array(count * 3);

  for (let n = 0; n < count; n += 1) {
    // When the glyphs offer fewer pixels than the budget, reuse them with extra
    // jitter instead of shrinking the field — denser strokes, same silhouette.
    const pixel = ink[n % take];
    const px = pixel % CANVAS_WIDTH;
    const py = Math.floor(pixel / CANVAS_WIDTH);

    // Always jitter by at least half a pixel so the raster grid never shows.
    const spread = Math.max(jitter, scale * 0.6) + (n >= take ? scale * 1.4 : 0);

    const o = n * 3;
    positions[o] = (px - CANVAS_WIDTH / 2) * scale + (Math.random() - 0.5) * spread;
    positions[o + 1] = -(py - canvasHeight / 2) * scale + (Math.random() - 0.5) * spread;
    positions[o + 2] = (Math.random() - 0.5) * depth;
  }

  // Let the browser reclaim the backing store immediately.
  canvas.width = 0;
  canvas.height = 0;

  return {
    positions,
    count,
    aspect: worldWidth / worldHeight,
    worldWidth,
    worldHeight,
    inkWidth: (maxX - minX + 1) * scale,
    inkHeight: (maxY - minY + 1) * scale,
  };
}
