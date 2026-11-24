// ─────────────────────────────────────────────────────────────────────────────
// Ambient dust — vertex stage.
//
// A slow volumetric haze that gives the void scale and parallax. Same instanced
// billboard + shader-DOF technique as the name field, but spread through a much
// larger volume and deliberately dim: it should register as atmosphere, not as
// particles.
//
// The field tiles infinitely around the camera: every mote is wrapped into a
// volume centred on `uOrigin`, so the camera can fly the whole path without
// ever leaving the haze, and without a single position being touched on the
// CPU. Wrapping (rather than parenting the field to the camera) is what keeps
// the parallax real — the motes stay put in world space as you pass them.
// ─────────────────────────────────────────────────────────────────────────────

#include "common"
#include "noise"

attribute vec3 aOffset;  // position within the volume
attribute vec3 aSeed;    // x: brightness, y: size, z: phase

uniform float uTime;
uniform float uSize;
uniform float uFocus;
uniform float uAperture;
uniform vec3  uVolume;     // half-extents of the dust volume
uniform vec3  uOrigin;     // camera world position — the volume follows it
uniform float uOpacity;
uniform vec2  uPointer;

varying vec2  vUv;
varying float vAlpha;
varying float vCoC;

void main() {
  vUv = uv;

  vec3 pos = aOffset;

  // Gentle flow-field drift. One noise lookup per axis at a very low frequency —
  // the motion should be barely perceptible.
  pos += flow(aOffset * 0.035 + aSeed.z, uTime * 0.02) * 1.4;

  // Constant slow fall.
  pos.y -= uTime * 0.22 * (0.4 + aSeed.y);

  // Tile the field around the camera on all three axes.
  vec3 rel = pos - uOrigin;
  rel = mod(rel + uVolume, uVolume * 2.0) - uVolume;
  pos = uOrigin + rel;

  pos.x += uPointer.x * 0.9;
  pos.y -= uPointer.y * 0.55;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  float coc = clamp(abs(dist - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);

  float size = uSize * (0.4 + aSeed.y * 1.1) * (1.0 + coc * 4.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;

  // Fade in at the edge of the volume and out as motes pass very close to the
  // lens, so the wrap never pops.
  float depthFade = 1.0 - remap01(dist, uVolume.z * 0.5, uVolume.z * 1.05);
  float nearFade = remap01(dist, 1.0, 6.0);

  vAlpha = uOpacity * aSeed.x * depthFade * nearFade / (1.0 + coc * coc * 10.0);
  vCoC = coc;
}
