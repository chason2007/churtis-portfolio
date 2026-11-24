/**
 * Point-cloud shape generators for the zone fields.
 *
 * Each returns a flat xyz buffer centred on the origin. They are deliberately
 * abstract rather than literal — the job is to give each zone a distinct
 * silhouette and rhythm as the camera arrives, not to illustrate the project.
 *
 * All of them are pure functions of (count, scale), so adding a shape means
 * adding one case here and one entry to `ShapeKind`.
 */

export type ShapeKind = 'lattice' | 'shell' | 'helix' | 'ring' | 'funnel';

export interface Shape {
  positions: Float32Array;
  /** Rough bounding radius, used for the proximity fade and framing. */
  radius: number;
}

const TAU = Math.PI * 2;

/** Uniform direction on the unit sphere (Marsaglia's method). */
function randomDirection(out: [number, number, number]): void {
  const u = Math.random() * 2 - 1;
  const phi = Math.random() * TAU;
  const s = Math.sqrt(1 - u * u);
  out[0] = Math.cos(phi) * s;
  out[1] = u;
  out[2] = Math.sin(phi) * s;
}

/**
 * A jittered 3D grid — structured, architectural, deliberately man-made.
 * Reads as a system or a platform rather than something organic.
 */
function lattice(count: number, scale: number): Shape {
  const positions = new Float32Array(count * 3);

  // A slab rather than a cube: wider than tall, which frames better.
  const ratio = [1.6, 1, 1.15];
  const cells = Math.max(2, Math.round(Math.cbrt(count / (ratio[0] * ratio[1] * ratio[2]))));
  const nx = Math.max(2, Math.round(cells * ratio[0]));
  const ny = Math.max(2, Math.round(cells * ratio[1]));
  const nz = Math.max(2, Math.round(cells * ratio[2]));

  const step = (scale * 2) / Math.max(nx, ny, nz);
  const jitter = step * 0.3;

  for (let i = 0; i < count; i += 1) {
    // Walk the grid, wrapping if the count exceeds the cell total.
    const n = i % (nx * ny * nz);
    const x = n % nx;
    const y = Math.floor(n / nx) % ny;
    const z = Math.floor(n / (nx * ny)) % nz;

    const o = i * 3;
    positions[o] = (x - (nx - 1) / 2) * step + (Math.random() - 0.5) * jitter;
    positions[o + 1] = (y - (ny - 1) / 2) * step + (Math.random() - 0.5) * jitter;
    positions[o + 2] = (z - (nz - 1) / 2) * step + (Math.random() - 0.5) * jitter;
  }

  return { positions, radius: scale * 1.6 };
}

/** A hollow sphere with a little thickness — a whole, closed system. */
function shell(count: number, scale: number): Shape {
  const positions = new Float32Array(count * 3);
  const dir: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < count; i += 1) {
    randomDirection(dir);
    // Most of the mass on the surface, a thin scatter inside for depth.
    const r = scale * (Math.random() < 0.85 ? 0.92 + Math.random() * 0.08 : Math.random() * 0.9);

    const o = i * 3;
    positions[o] = dir[0] * r;
    positions[o + 1] = dir[1] * r;
    positions[o + 2] = dir[2] * r;
  }

  return { positions, radius: scale };
}

/** A double helix — sequence, flow, something being transcribed. */
function helix(count: number, scale: number): Shape {
  const positions = new Float32Array(count * 3);
  const turns = 3.25;
  const height = scale * 2.4;
  const radius = scale * 0.72;

  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(count - 1, 1);
    const strand = i % 2;
    const angle = t * turns * TAU + strand * Math.PI;

    // Radius breathes along the length so it is not a perfect cylinder.
    const r = radius * (0.72 + 0.28 * Math.sin(t * Math.PI));
    const jitter = scale * 0.07;

    const o = i * 3;
    positions[o] = Math.cos(angle) * r + (Math.random() - 0.5) * jitter;
    positions[o + 1] = (t - 0.5) * height + (Math.random() - 0.5) * jitter;
    positions[o + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * jitter;
  }

  return { positions, radius: Math.max(radius, height / 2) };
}

/** A torus seen edge-on — an orbit, a horizon, something continuous. */
function ring(count: number, scale: number): Shape {
  const positions = new Float32Array(count * 3);
  const major = scale;
  const minor = scale * 0.13;

  for (let i = 0; i < count; i += 1) {
    const u = Math.random() * TAU;
    const v = Math.random() * TAU;
    // Bias towards the tube surface so the ring reads as a band, not a blur.
    const r = minor * (0.7 + Math.random() * 0.3);

    const o = i * 3;
    positions[o] = (major + r * Math.cos(v)) * Math.cos(u);
    positions[o + 1] = r * Math.sin(v);
    positions[o + 2] = (major + r * Math.cos(v)) * Math.sin(u);
  }

  return { positions, radius: major + minor };
}

/** A converging cone — everything narrowing to a single point of contact. */
function funnel(count: number, scale: number): Shape {
  const positions = new Float32Array(count * 3);
  const height = scale * 2.2;

  for (let i = 0; i < count; i += 1) {
    const t = Math.pow(Math.random(), 0.65); // denser towards the mouth
    const angle = Math.random() * TAU;
    const r = scale * Math.pow(1 - t, 1.6);
    const jitter = scale * 0.04;

    const o = i * 3;
    positions[o] = Math.cos(angle) * r + (Math.random() - 0.5) * jitter;
    positions[o + 1] = (0.5 - t) * height;
    positions[o + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * jitter;
  }

  return { positions, radius: Math.max(scale, height / 2) };
}

const BUILDERS: Record<ShapeKind, (count: number, scale: number) => Shape> = {
  lattice,
  shell,
  helix,
  ring,
  funnel,
};

export function buildShape(kind: ShapeKind, count: number, scale: number): Shape {
  return BUILDERS[kind](count, scale);
}

/** Shapes assigned to projects, in order, cycling once the list runs out. */
export const PROJECT_SHAPES: ShapeKind[] = ['lattice', 'shell', 'helix'];

export function shapeForProject(index: number): ShapeKind {
  return PROJECT_SHAPES[index % PROJECT_SHAPES.length];
}
