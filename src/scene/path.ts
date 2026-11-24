import * as THREE from 'three';
import { buildOutline, laneFor, type OutlineEntry } from '../content/outline';
import { shapeForProject, type ShapeKind } from './objects/shapes';

/**
 * The camera path and the zones along it.
 *
 * Takes the content outline and attaches world-space geometry: where the camera
 * stands at each stop, what it aims at, and what structure is drawn there.
 * Everything is procedural from the layout constants below — adding a project
 * lengthens the path and places a new zone with no coordinates to hand-edit.
 *
 * Layout rule: zones alternate sides as the camera travels down -Z, and the
 * camera weaves the opposite way, so each structure arrives from one side of
 * frame while the HTML copy sits on the other.
 */

export interface Zone extends OutlineEntry {
  /** Camera position at this stop. */
  camera: THREE.Vector3;
  /** What the camera aims at here. */
  target: THREE.Vector3;
  /** The structure drawn at this stop. The hero has none — the name is it. */
  shape?: ShapeKind;
  shapeScale?: number;
  shapePosition?: THREE.Vector3;
}

/** Distance between consecutive zones along -Z. */
const SPACING = 26;
/** How far a zone's structure sits off the centre line. */
const LANE = 5;
/** How far the camera weaves the opposite way. */
const CAMERA_LANE = 2.4;
/** How far the look-target is pulled back towards centre, which is what pushes
 *  the structure off to its side of frame. */
const TARGET_PULL = 3.2;
/** Vertical weave, so the path is not perfectly flat. */
const RISE = 0.85;
/** How far ahead of the camera each structure sits. */
const LEAD = 12;

/** Resting camera distance from the hero wordmark. */
export const HERO_DISTANCE = 9;

/**
 * Structures for the non-project stops. Projects cycle through their own set.
 *
 * `laneScale` and `targetPull` push a structure further off the centre line.
 * Contact needs both: its copy is centred rather than offset to one side, so
 * the funnel has to clear the middle of the frame completely.
 */
const FIXED_SHAPES: Partial<
  Record<
    OutlineEntry['kind'],
    { shape: ShapeKind; scale: number; laneScale?: number; targetPull?: number }
  >
> = {
  about: { shape: 'ring', scale: 3.6 },
  skills: { shape: 'lattice', scale: 3.2 },
  contact: { shape: 'funnel', scale: 3.6, laneScale: 2, targetPull: 5 },
};

export function buildZones(): Zone[] {
  const outline = buildOutline();
  let projectIndex = 0;

  return outline.map((entry, i) => {
    // The hero is fixed: the camera sits back from the wordmark at the origin.
    if (entry.kind === 'hero') {
      return {
        ...entry,
        camera: new THREE.Vector3(0, 0, HERO_DISTANCE),
        target: new THREE.Vector3(0, 0, 0),
      };
    }

    const lane = laneFor(i);
    const rise = i % 4 < 2 ? RISE : -RISE;
    const z = -SPACING * i;

    const fixed = FIXED_SHAPES[entry.kind];
    const shape = fixed ? fixed.shape : shapeForProject(projectIndex);
    const shapeScale = fixed ? fixed.scale : 3.0;
    if (!fixed) projectIndex += 1;

    const shapePosition = new THREE.Vector3(
      lane * LANE * (fixed?.laneScale ?? 1),
      rise * 0.8,
      z - LEAD,
    );

    return {
      ...entry,
      camera: new THREE.Vector3(-lane * CAMERA_LANE, -rise * 0.5, z),
      target: new THREE.Vector3(
        shapePosition.x - lane * (fixed?.targetPull ?? TARGET_PULL),
        shapePosition.y * 0.5,
        shapePosition.z,
      ),
      shape,
      shapeScale,
      shapePosition,
    };
  });
}

export interface CameraPath {
  zones: Zone[];
  /** Camera position as a function of path parameter. */
  position: THREE.CatmullRomCurve3;
  /** Look-at point as a function of path parameter. */
  target: THREE.CatmullRomCurve3;
  /**
   * Path parameter at which zone `i` sits.
   *
   * Uniform by construction: `CatmullRomCurve3.getPoint(i / (n - 1))` returns
   * control point `i` exactly. That is what lets the scroll driver line a DOM
   * section up with its zone without an arc-length search every frame.
   */
  parameterFor(index: number): number;
  /** Spacing between adjacent zones in path parameter. */
  step: number;
}

export function buildPath(zones: Zone[]): CameraPath {
  // Low tension gives a long, lazy arc through the control points rather than a
  // taut polyline. This is most of what makes the flight read as a camera move
  // and not a slideshow.
  const tension = 0.35;

  const position = new THREE.CatmullRomCurve3(
    zones.map((z) => z.camera),
    false,
    'catmullrom',
    tension,
  );

  const target = new THREE.CatmullRomCurve3(
    zones.map((z) => z.target),
    false,
    'catmullrom',
    tension,
  );

  const last = Math.max(zones.length - 1, 1);

  return {
    zones,
    position,
    target,
    parameterFor: (index: number) => THREE.MathUtils.clamp(index / last, 0, 1),
    step: 1 / last,
  };
}
