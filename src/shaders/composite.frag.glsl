// ─────────────────────────────────────────────────────────────────────────────
// Final composite — vignette, film grain, lens aberration and dither.
//
// Runs AFTER tone mapping and the sRGB conversion (see scene/post/Composer.ts),
// because grain and vignette are display-referred effects: applied in linear
// space they crush the blacks and the grain becomes invisible in shadow.
//
// The dither term matters more than it looks: a near-black gradient across a
// 1440p display bands badly in 8-bit, and a half-LSB of noise removes it
// entirely for free.
// ─────────────────────────────────────────────────────────────────────────────

#include "common"

uniform sampler2D tDiffuse;
uniform float uTime;
uniform vec2  uResolution;
uniform float uGrain;        // grain amount, 0 disables
uniform float uVignette;     // vignette strength
uniform float uAberration;   // lateral chromatic aberration, in pixels at the edge
uniform float uExposure;     // final trim

varying vec2 vUv;

void main() {
  vec2 centred = vUv - 0.5;
  // Aspect-correct the radius so the vignette stays circular on any window.
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float r = length(centred * aspect);

  vec3 color;
  if (uAberration > 0.0) {
    // Radial split: red pulls out, blue pulls in, green stays put. Scaled by
    // r^2 so the centre of frame stays perfectly clean.
    vec2 dir = centred * (r * r) * uAberration / uResolution;
    color = vec3(
      texture2D(tDiffuse, vUv + dir).r,
      texture2D(tDiffuse, vUv).g,
      texture2D(tDiffuse, vUv - dir).b
    );
  } else {
    color = texture2D(tDiffuse, vUv).rgb;
  }

  color *= uExposure;

  // Vignette — a soft falloff, not a black ring.
  float vig = smoothstep(1.25, 0.25, r);
  color *= mix(1.0, vig, uVignette);

  if (uGrain > 0.0) {
    // Temporally animated grain, weighted by luminance so the blacks stay
    // clean and the highlights do not sparkle.
    float n = hash12(vUv * uResolution + fract(uTime) * 1371.0) - 0.5;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float weight = smoothstep(0.0, 0.28, luma) * (1.0 - smoothstep(0.55, 1.0, luma));
    color += n * uGrain * (0.25 + weight);
  }

  // Half-LSB ordered-ish dither: kills 8-bit banding in the dark gradients.
  color += (hash12(vUv * uResolution + 0.5) - 0.5) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
