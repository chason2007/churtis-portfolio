// ─────────────────────────────────────────────────────────────────────────────
// Name field — fragment stage.
//
// Draws each particle as a soft point spread function: a tight core when in
// focus, a flatter bokeh disc when defocused. Additively blended, so the
// overlapping cores in the glyph strokes build to near-white while the sparse
// cloud stays accent-coloured.
// ─────────────────────────────────────────────────────────────────────────────

#include "common"

uniform vec3 uColorCore;    // off-white — the resolved letterforms
uniform vec3 uColorAccent;  // the one accent — the unresolved cloud
uniform vec3 uColorLift;    // cooler tint on defocused particles

varying vec2  vUv;
varying float vAlpha;
varying float vCoC;
varying float vSeed;
varying float vResolve;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);          // squared radius — avoids a sqrt
  if (r2 > 1.0) discard;         // trim the quad to a disc

  float core = pow(1.0 - r2, 3.0);            // in focus: bright centre, soft halo
  float disc = smoothstep(1.0, 0.45, r2);     // defocused: flatter bokeh disc
  float shape = mix(core, disc * 0.5, vCoC);

  // Colour ramp: accent in the cloud, near-white once resolved, cool lift on
  // the defocused particles so the bloom reads blue rather than grey.
  vec3 color = mix(uColorAccent, uColorCore, vResolve * (0.35 + vSeed * 0.65));
  color = mix(color, uColorLift, vCoC * 0.6);

  float alpha = shape * vAlpha;
  if (alpha < 0.002) discard;

  // Additive blending multiplies by alpha for us, so emit straight colour.
  gl_FragColor = vec4(color, alpha);
}
