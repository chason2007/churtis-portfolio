// ─────────────────────────────────────────────────────────────────────────────
// Ambient dust — vertex stage.
//
// A slow volumetric haze that gives the void scale and parallax. Same instanced
// billboard + shader-DOF technique as the name field, but spread through a much
// larger volume and deliberately dim: it should register as atmosphere, not as
// particles. Wraps on Z so the field can be flown through forever (step 3).
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

  // Constant slow fall, wrapped into the volume so nothing ever leaves it.
  pos.y -= uTime * 0.22 * (0.4 + aSeed.y);
  pos.y = mod(pos.y + uVolume.y, uVolume.y * 2.0) - uVolume.y;

  pos.x += uPointer.x * 0.9;
  pos.y -= uPointer.y * 0.55;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  float coc = clamp(abs(dist - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);

  float size = uSize * (0.4 + aSeed.y * 1.1) * (1.0 + coc * 4.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;

  // Fade in from the far plane and out as motes pass very close to the lens,
  // so nothing ever pops into existence.
  float depthFade = 1.0 - remap01(dist, uVolume.z * 0.65, uVolume.z * 1.6);
  float nearFade = remap01(dist, 1.0, 6.0);

  vAlpha = uOpacity * aSeed.x * depthFade * nearFade / (1.0 + coc * coc * 10.0);
  vCoC = coc;
}
