// ─────────────────────────────────────────────────────────────────────────────
// Name field — vertex stage.
//
// One instanced quad per particle. Each particle owns a scattered origin and a
// resting target sampled from the wordmark's glyph coverage; `uProgress` drives
// the morph between them, staggered per particle inside the shader so the whole
// reveal is a single CPU-side tween.
//
// Depth of field is computed here rather than as a post pass — see the note by
// the circle-of-confusion maths below.
// ─────────────────────────────────────────────────────────────────────────────

#include "common"
#include "noise"

// Per-instance attributes
attribute vec3 aTarget;  // resting position inside the wordmark
attribute vec3 aOrigin;  // scattered start position
attribute vec3 aSeed;    // x: stagger delay, y: size/brightness variance, z: drift phase

uniform float uTime;
uniform float uProgress;   // 0 = scattered cloud, 1 = resolved wordmark
uniform float uSize;       // base quad size in world units
uniform float uFocus;      // focal distance from the camera, world units
uniform float uAperture;   // circle-of-confusion gain
uniform float uDrift;      // idle drift amplitude once resolved
uniform float uIntensity;  // per-particle brightness; see the note in NameField.ts
uniform vec2  uPointer;    // smoothed pointer, -1..1
uniform float uDissolve;   // 0..1 exit, driven by scroll (step 3)

varying vec2  vUv;
varying float vAlpha;
varying float vCoC;
varying float vSeed;
varying float vResolve;

void main() {
  vUv = uv;

  // Per-particle stagger: later particles start later but all finish together,
  // which reads as the wordmark "crystallising" rather than sliding in.
  float delay = aSeed.x * 0.55;
  float resolve = easeOutQuint(remap01(uProgress, delay, 1.0));

  // Scattered state — a slow swirl so the cloud is alive before it resolves.
  float swirl = (1.0 - resolve) * (0.9 + aSeed.y * 0.6);
  vec3 scattered = rotateY(aOrigin, uTime * 0.07 * (0.5 + aSeed.z) + swirl);
  scattered += flow(aOrigin * 0.08 + aSeed.z, uTime * 0.05) * 1.6 * (1.0 - resolve);

  // Resting state — micro-drift keeps the letters breathing, never frozen.
  vec3 resting = aTarget + flow(aTarget * 0.55 + aSeed.z * 4.0, uTime * 0.12) * uDrift;

  vec3 pos = mix(scattered, resting, resolve);

  // Pointer parallax, scaled per particle so the wordmark gains real volume as
  // the cursor moves instead of sliding as one flat plane.
  float depthBias = 0.5 + aSeed.y;
  pos.x += uPointer.x * 0.26 * depthBias;
  pos.y -= uPointer.y * 0.16 * depthBias;

  // Scroll exit: blow the field outwards along its own scatter direction.
  pos += normalize(aOrigin + 0.0001) * uDissolve * 8.0;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  // --- Depth of field, done here.
  // A true bokeh pass needs a depth prepass plus a wide gather blur. For a
  // particle field the cheaper and better-looking route is to inflate each
  // sprite by its circle of confusion and drop its density to match, which is
  // physically what defocus does to a point light. Cost: a few instructions.
  float coc = clamp(abs(dist - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);

  float size = uSize * (0.55 + aSeed.y * 0.9);
  size *= 1.0 + coc * 5.0;          // defocus spreads the sprite
  size *= mix(0.4, 1.0, resolve);   // particles grow as they settle

  // Billboard: offset in view space so the quad always faces the camera.
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;

  // Energy conservation: a blurrier sprite covers more pixels, so dim it by
  // roughly its area change to keep total brightness stable across the field.
  float density = 1.0 / (1.0 + coc * coc * 22.0);
  float twinkle = 0.82 + 0.18 * sin(uTime * (1.2 + aSeed.z * 2.0) + aSeed.x * TAU);

  vAlpha   = uIntensity * density * twinkle * (1.0 - uDissolve) * mix(0.75, 1.0, resolve);
  vCoC     = coc;
  vSeed    = aSeed.y;
  vResolve = resolve;
}
