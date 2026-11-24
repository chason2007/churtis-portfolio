// Ambient dust — fragment stage. Soft disc, single flat colour, very low alpha.

#include "common"

uniform vec3 uColor;
uniform vec3 uColorAccent;

varying vec2  vUv;
varying float vAlpha;
varying float vCoC;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;

  float shape = pow(1.0 - r2, mix(3.0, 1.4, vCoC));
  float alpha = shape * vAlpha;
  if (alpha < 0.002) discard;

  // A touch of accent on the defocused motes ties the haze to the palette.
  vec3 color = mix(uColor, uColorAccent, vCoC * 0.5);
  gl_FragColor = vec4(color, alpha);
}
