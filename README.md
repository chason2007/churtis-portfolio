# Chason Hurtis — Portfolio

An immersive 3D developer portfolio. Dark, cinematic, built on Vite + TypeScript +
Three.js with custom GLSL, and designed to degrade cleanly to a fast static 2D page
when the device or the visitor's preferences call for it.

**Status:** steps 1–2 of 7 complete — scaffold, core systems, loading sequence, and the
hero's signature moment. Scroll zones, projects, nav, fallback polish and the
performance pass are still to come.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typechecks, then emits dist/
npm run preview  # serve the production build locally
```

Node 22+ (see `.nvmrc`).

### Useful query-string overrides (dev + production)

The two rendering paths are hard to see on one machine — if your OS has "reduce motion"
enabled, for example, you will only ever get the flat layout. These force the issue:

| URL | Effect |
| --- | --- |
| `?mode=3d` | Force the WebGL experience |
| `?mode=flat` | Force the 2D layout |
| `?tier=low` \| `medium` \| `high` | Force a render budget |

`?mode=3d` never overrides a genuine capability failure — with no WebGL2, or on a
software rasteriser, you still get the flat layout.

---

## Where to edit things

Almost everything you will want to change lives in two files.

### Content — `src/content/site.ts`

The single source of truth for every piece of copy on the site: hero, about, projects,
skills, contact, and the `<head>` metadata. It is fully typed (`src/content/types.ts`),
so your editor will tell you if a field is missing.

**Adding a project** means appending one object to the `projects` array:

```ts
{
  id: 'my-project',          // slug — becomes the URL hash and the 3D zone id
  index: '04',               // shown in the nav and the zone label
  title: 'My Project',
  subtitle: 'What it is',
  role: 'Full-Stack Developer',
  blurb: 'One sentence, shown as the camera arrives.',
  body: ['A paragraph.', 'Another paragraph.'],
  highlights: ['Scannable outcome', 'Another one'],
  stack: ['Next.js', 'Postgres'],
  links: [{ label: 'Live', href: 'https://…' }],
}
```

The quick nav, the camera path, the 3D zone and the detail panel all derive from that
array — there is nothing else to wire up.

Anything still waiting on a real value is marked `placeholder: true` and/or a `// TODO:`
comment. Placeholder links render visibly disabled rather than sending a recruiter to a
404. Search the repo for `TODO` to find them all.

#### Hero copy is duplicated on purpose

`index.html` carries the hero's real text so it paints and crawls before any JavaScript
runs. `site.ts` is still the authority: elements tagged `data-content="hero.tagline"` are
rebound at boot, and in development a mismatch logs a `[content]` warning telling you to
update the markup. Keep the two in sync; the warning makes drift impossible to miss.

### Colours and type — `src/styles/tokens.css`

Every colour, font, size and easing curve in the project is a custom property here.
There are no hex values anywhere else.

**Swap the accent:**

```css
--c-accent: #d98a2b;        /* warm amber instead of electric blue */
--c-accent-lift: #f3c489;   /* the bright end of gradients */
--c-accent-sunk: #8a4f12;
--c-accent-glow: rgba(217, 138, 43, 0.28);
```

The WebGL scene reads these at boot via `src/content/theme.ts`, so the particles, the
dust and the bloom tint all follow. You do not touch a shader to recolour the site.

**Swap the fonts:**

1. Download the variable `woff2` (latin + latin-ext subsets) into `src/fonts/`.
   They live in `src/` rather than `public/` so Vite hashes them and rewrites the URLs,
   which is what keeps the paths correct under a GitHub Pages subpath.
2. Update the `@font-face` blocks in `src/styles/fonts.css`.
3. Point `--font-display` / `--font-body` in `tokens.css` at the new families.
4. If you changed the **display** face, update `DISPLAY_FONT` and `DISPLAY_WEIGHT` in
   `src/scene/Experience.ts` — the particle wordmark is rasterised from that exact face,
   so the 3D type and the HTML type stay identical.

---

## Deploy

The build is fully static. No server, no API keys, no paid services.

### Vercel

```bash
npm i -g vercel && vercel
```

Framework preset **Vite**, build command `npm run build`, output directory `dist`.
Nothing else to configure — `base` defaults to `/`.

### GitHub Pages

A project site is served from `/<repo>/`, so the build needs a matching base path:

```bash
BASE_PATH=/churtis-portfolio/ npm run build
```

Then publish `dist/` — either with the `actions/deploy-pages` workflow or by pushing it
to a `gh-pages` branch. On a user site (`<user>.github.io`) or a custom domain, omit
`BASE_PATH`.

### Before you ship

- [ ] Add `public/og.png` (1200×630 — a frame of the hero reveal works well)
- [ ] Add `public/chason-hurtis-resume.pdf`
- [ ] Replace the `https://chasonhurtis.com` placeholders in `index.html` (canonical +
      OG URLs) and `site.ts` (`meta.url`)
- [ ] Fill in the GitHub URL and the project links in `site.ts`

---

## How it is put together

```
src/
  main.ts            entry point — capability check, boot sequence, nothing else
  content/           typed site data (site.ts, types.ts) + the CSS→WebGL theme bridge
  core/              framework-free systems: capabilities, ticker, viewport, pointer, dispose
  scene/             Three.js — Experience (orchestrator), CameraRig, renderer
    objects/         NameField, DustField, and the text→point-cloud sampler
    post/            the post-processing chain
  shaders/           GLSL, with a tiny #include resolver (glsl.ts)
  ui/                DOM-side: Loader, Hero, content binding, helpers
  styles/            tokens.css first, then base + one sheet per component
  fonts/             self-hosted variable woff2
```

### Decisions worth knowing about

**Three.js is behind a dynamic import.** The initial payload is ~13KB of JS. Three only
downloads once `detectCapabilities()` decides this device gets the 3D scene, so phones
and reduced-motion visitors never pay for it.

**Depth of field is in the vertex shader, not a post pass.** A true bokeh pass needs a
depth prepass and a wide gather blur. For a field of emissive points you get a better
result for a few instructions by inflating each sprite by its circle of confusion and
dropping its density to match — which is physically what defocus does to a point light.
See the note in `shaders/nameField.vert.glsl`.

**The wordmark is one draw call.** `NameField` is a single `InstancedBufferGeometry`:
position, per-particle stagger, DOF and the scroll exit all happen on the GPU from three
static attributes, so CPU cost per frame is a handful of uniform writes no matter the
particle count.

**Particle count is deliberately modest.** The wordmark covers only ~48k screen pixels at
1440p. Above roughly 20k particles the field is denser than the pixel grid and collapses
into flat vector type — indistinguishable from an `<h1>`, which defeats the point. Fewer,
brighter points that the eye integrates is the look; the bloom pass binds them together.
The `[textSampler]` log in development prints the coverage maths.

**The hero copy is positioned against the 3D wordmark.** The scene reports back how tall
the letterforms actually render (`--wordmark-h`), derived from the camera's real frustum,
so the HTML sits exactly against them at any window size instead of being eyeballed.

**Post-processing order matters.** Bloom runs before tone mapping (on HDR values, the only
place a threshold means anything); grain and vignette run after it, in display space,
where film grain behaves like film grain.

### Accessibility and SEO

- All content is real HTML text overlaid on the canvas. Nothing is rendered to a texture.
- In 3D mode the `<h1>` is visually hidden but present and crawlable; in flat mode it
  becomes the visible headline.
- Skip link, visible focus rings on every interactive element, semantic landmarks, and a
  `<noscript>` block with the core content and contact details.
- `prefers-reduced-motion: reduce` serves the static 2D layout, and every CSS animation
  has a reduced-motion branch.
- Person JSON-LD, Open Graph and Twitter cards in `index.html`.

---

## Roadmap

- [x] 1 — Scaffold, core systems, resize/dispose handling, loading sequence
- [x] 2 — Hero: name-from-geometry, camera, post-processing, mouse parallax
- [ ] 3 — Scroll system + camera path through zones, data-driven content overlay
- [ ] 4 — Project zones, quick nav, project detail panels
- [ ] 5 — Reduced-motion / mobile 2D fallback polish
- [ ] 6 — Audio toggle, custom cursor, transitions, SEO/a11y pass
- [ ] 7 — Performance pass (profiling, adaptive quality) + docs
