// ─────────────────────────────────────────────────────────────────────────────
// Shared GLSL helpers. Pulled in with `#include "common"` (see src/shaders/glsl.ts).
// ─────────────────────────────────────────────────────────────────────────────

#ifndef COMMON_INCLUDED
#define COMMON_INCLUDED

#define PI  3.141592653589793
#define TAU 6.283185307179586

// Cheap, stable hash. Good enough for per-instance randomness and dithering.
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Rotate a vector around the Y axis.
vec3 rotateY(vec3 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// Easing curves, matched to the GSAP equivalents used on the CPU side so the
// shader-side stagger feels like part of the same timeline.
float easeOutCubic(float t)  { return 1.0 - pow(1.0 - t, 3.0); }
float easeOutQuint(float t)  { return 1.0 - pow(1.0 - t, 5.0); }
float easeInOutCubic(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

// Remap x from [a,b] to [0,1], clamped.
float remap01(float x, float a, float b) {
  return clamp((x - a) / (b - a), 0.0, 1.0);
}

#endif
