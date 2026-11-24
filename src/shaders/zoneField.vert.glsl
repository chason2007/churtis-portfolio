// ─────────────────────────────────────────────────────────────────────────────
// Zone field — vertex stage.
//
// The structure that sits at each stop on the camera path. Same instanced
// billboard + shader-DOF technique as the hero's name field, but driven by
// proximity rather than a timeline: `uReveal` rises as the camera approaches,
// assembling the shape out of a scatter, and falls again as it leaves.
//
// The shape itself is static geometry (see objects/shapes.ts); everything that
// moves is computed here.
// ─────────────────────────────────────────────────────────────────────────────

#include "common"
#include "noise"

attribute vec3 aOffset;  // resting position within the shape
attribute vec3 aSeed;    // x: stagger, y: size/brightness variance, z: drift phase

uniform float uTime;
uniform float uReveal;     // 0 = scattered and invisible, 1 = assembled
uniform float uSize;
uniform float uIntensity;
uniform float uFocus;
uniform float uAperture;
uniform float uScatter;    // how far the unassembled state throws particles
uniform float uDrift;
uniform vec2  uPointer;

varying vec2  vUv;
varying float vAlpha;
varying float vCoC;
varying float vSeed;

void main() {
  vUv = uv;

  // Per-particle stagger, so the shape knits together rather than popping.
  float reveal = easeOutCubic(remap01(uReveal, aSeed.x * 0.4, 1.0));

  vec3 scattered = aOffset * (1.0 + uScatter) +
                   flow(aOffset * 0.12 + aSeed.z, uTime * 0.05) * uScatter * 2.0;

  vec3 resting = aOffset + flow(aOffset * 0.3 + aSeed.z * 3.0, uTime * 0.09) * uDrift;

  vec3 pos = mix(scattered, resting, reveal);

  // A touch of pointer parallax so the zone feels inhabited, not a backdrop.
  pos.x += uPointer.x * 0.3 * (0.5 + aSeed.y);
  pos.y -= uPointer.y * 0.2 * (0.5 + aSeed.y);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  float coc = clamp(abs(dist - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);

  float size = uSize * (0.5 + aSeed.y * 1.0);
  size *= 1.0 + coc * 5.0;
  size *= mix(0.3, 1.0, reveal);

  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;

  float density = 1.0 / (1.0 + coc * coc * 22.0);
  float twinkle = 0.78 + 0.22 * sin(uTime * (0.9 + aSeed.z * 1.6) + aSeed.x * TAU);

  vAlpha = uIntensity * density * twinkle * reveal;
  vCoC = coc;
  vSeed = aSeed.y;
}
