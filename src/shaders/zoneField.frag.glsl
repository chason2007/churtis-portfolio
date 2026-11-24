// Zone field — fragment stage.
//
// Zones lean on the accent rather than the near-white the wordmark uses: the
// name is the only thing on the site allowed to be the brightest element.

#include "common"

uniform vec3 uColor;
uniform vec3 uColorAccent;

varying vec2  vUv;
varying float vAlpha;
varying float vCoC;
varying float vSeed;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;

  float core = pow(1.0 - r2, 3.0);
  float disc = smoothstep(1.0, 0.45, r2);
  float shape = mix(core, disc * 0.5, vCoC);

  // Variance across the field: some particles sit at the accent, some lift
  // towards the ink, which keeps a single-hue cloud from going flat.
  vec3 color = mix(uColorAccent, uColor, vSeed * 0.55);

  float alpha = shape * vAlpha;
  if (alpha < 0.002) discard;

  gl_FragColor = vec4(color, alpha);
}
