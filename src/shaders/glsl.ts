import common from './lib/common.glsl?raw';
import noise from './lib/noise.glsl?raw';

/**
 * A tiny `#include` resolver for GLSL.
 *
 * Vite's `?raw` import gives us shader source as a string, but no include
 * mechanism. Rather than pull in a plugin, this resolves `#include "name"`
 * against the map below, recursively and idempotently (the chunks guard
 * themselves with `#ifndef`, so a double-include is harmless).
 */
const CHUNKS: Record<string, string> = {
  common,
  noise,
};

const INCLUDE = /^[ \t]*#include[ \t]+"([\w-]+)"[ \t]*$/gm;

export function resolveIncludes(source: string, depth = 0): string {
  if (depth > 8) throw new Error('[glsl] #include nested too deeply — check for a cycle');

  return source.replace(INCLUDE, (_match, name: string) => {
    const chunk = CHUNKS[name];
    if (chunk === undefined) {
      throw new Error(`[glsl] unknown #include "${name}" — add it to CHUNKS in shaders/glsl.ts`);
    }
    return resolveIncludes(chunk, depth + 1);
  });
}
