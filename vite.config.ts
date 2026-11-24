import { defineConfig } from 'vite';

/**
 * Vite config.
 *
 * `base` is driven by an env var so the same build works on both targets:
 *   - Vercel / custom domain / user.github.io  ->  BASE_PATH unset (defaults to "/")
 *   - GitHub Pages project site               ->  BASE_PATH=/churtis-portfolio/
 *
 * See README "Deploy".
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',

  build: {
    target: 'es2022',
    // Source maps are small relative to the 3D payload and make profiling the
    // shader/render path on a real device far easier.
    sourcemap: true,
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep Three.js in its own long-cacheable chunk. It is only fetched
          // when the capability check decides to boot the 3D experience
          // (see src/main.ts -> dynamic import of ./scene/Experience).
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap')) return 'gsap';
          if (id.includes('node_modules/lenis')) return 'lenis';
          return undefined;
        },
      },
    },
  },

  server: {
    host: true,
    open: false,
  },
});
