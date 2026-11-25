# Chason Hurtis — Portfolio

Live: **https://churtis.vercel.app**

An immersive 3D developer portfolio. Dark, cinematic, built on Vite + TypeScript +
Three.js with custom GLSL — and it degrades to a fast, properly designed static page
when the device or the visitor's preferences call for it.

The opening resolves the name out of a particle cloud; scrolling flies a camera along a
curated path through a zone per section. A fixed nav rail puts every project one click
away from anywhere on the page.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typechecks, then emits dist/
npm run preview  # serve the production build locally
```

Node 22+ (see `.nvmrc`).

### Query-string overrides

These work in development and production. The two rendering paths are otherwise hard to
see on one machine — if your OS has "reduce motion" enabled, for instance, you will only
ever get the flat layout.

| URL | Effect |
| --- | --- |
| `?mode=3d` | Force the WebGL experience |
| `?mode=flat` | Force the 2D layout |
| `?tier=low` \| `medium` \| `high` | Force a render budget |
| `?stats` | Show a frame-time and quality-level readout |

`?mode=3d` never overrides a genuine capability failure — with no WebGL2, or on a
software rasteriser, you still get the flat layout.

---

## Where to edit things

Almost everything you will want to change lives in two files.

### Content — `src/content/site.ts`

The single source of truth for every piece of copy on the site: hero, about, projects,
skills, contact, and the `<head>` metadata. Fully typed (`src/content/types.ts`), so
your editor will tell you if a field is missing.

**Adding a project** means appending one object to the `projects` array:

```ts
{
  id: 'my-project',          // slug — the URL hash, the section id and the zone id
  index: '04',               // shown in the nav rail and the section label
  title: 'My Project',
  subtitle: 'What it is',
  role: 'Full-Stack Developer',
  blurb: 'One sentence, shown as the camera arrives.',
  body: ['A paragraph.', 'Another paragraph.'],   // behind the Details disclosure
  highlights: ['Scannable outcome', 'Another one'],
  stack: ['Next.js', 'Postgres'],
  links: [{ label: 'Live', href: 'https://…' }],
}
```

That one edit gives you a new HTML section, a new nav entry, a new stop on the camera
path (which lengthens automatically), and a new 3D structure. There are no coordinates
to hand-edit and nothing else to wire up — see `src/content/outline.ts`, which is the
shared spine the sections, the nav and the camera path all read.

Project structures cycle through `PROJECT_SHAPES` in `src/scene/objects/shapes.ts`
(lattice → shell → helix). Add a shape there to extend the rotation.

A link with `placeholder: true` renders visibly disabled rather than sending a recruiter
to a 404 — useful while a URL is still pending. Nothing is currently marked that way.
A project with no public URL at all takes `links: []`, and the list is omitted entirely
rather than rendered empty.

#### Hero copy is duplicated on purpose

`index.html` carries the hero's real text so it paints and crawls before any JavaScript
runs. `site.ts` is still the authority: elements tagged `data-content="hero.tagline"` are
rebound at boot, and in development a mismatch logs a `[content]` warning telling you to
update the markup. The warning makes drift impossible to miss.

### Colours and type — `src/styles/tokens.css`

Every colour, font, size and easing curve is a custom property here. There are no hex
values anywhere else in the project.

**Swap the accent:**

```css
--c-accent: #d98a2b;        /* warm amber instead of electric blue */
--c-accent-lift: #f3c489;   /* the bright end of gradients */
--c-accent-sunk: #8a4f12;
--c-accent-glow: rgba(217, 138, 43, 0.28);
```

The WebGL scene reads these at boot via `src/content/theme.ts`, so the particles, the
zone structures, the dust and the bloom tint all follow. You do not touch a shader to
recolour the site.

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

The build is fully static. No server, no API keys, no paid services, no third-party
requests at runtime (the fonts are self-hosted).

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

- [x] `public/og.png` — a 1200×630 frame of the settled hero
- [x] Deployed at https://churtis.vercel.app — canonical, OG and robots.txt all point there
- [x] Project links wired up — every link on the site now resolves

---

## How it is put together

```
src/
  main.ts            entry point — capability check, boot sequence, nothing else
  content/           typed site data, the section outline, the CSS→WebGL theme bridge
  core/              framework-free systems:
                       capabilities  render budget + the 3D/2D decision
                       ticker        the single rAF loop
                       viewport      debounced resize with a pixel-ratio cap
                       pointer       damped pointer for parallax
                       scroll        DOM-anchored scroll → camera path mapping
                       perf          adaptive quality guard
                       dispose       explicit GPU resource release
  scene/             Three.js — Experience (orchestrator), CameraRig, path, renderer
    objects/         NameField, ZoneField, DustField, shapes, the text sampler
    post/            the post-processing chain
  shaders/           GLSL, with a tiny #include resolver (glsl.ts)
  ui/                DOM-side: Loader, Hero, Sections, Nav, Cursor
  styles/            tokens.css first, then base + one sheet per component
  fonts/             self-hosted variable woff2
```

### Decisions worth knowing about

**Three.js is behind a dynamic import.** The initial payload is ~10KB of JS gzipped.
Three only downloads once `detectCapabilities()` decides this device gets the 3D scene,
so phones and reduced-motion visitors never pay for it. GSAP and Lenis are lazy too —
shipping a smooth-scrolling library to someone who asked for reduced motion was a
particularly bad look.

**Depth of field is in the vertex shader, not a post pass.** A true bokeh pass needs a
depth prepass and a wide gather blur. For a field of emissive points you get a better
result for a few instructions by inflating each sprite by its circle of confusion and
dropping its density to match — which is physically what defocus does to a point light.
See the note in `shaders/nameField.vert.glsl`.

**One draw call per field.** Every particle field is a single `InstancedBufferGeometry`:
position, stagger, DOF, assembly and the scroll exit all happen on the GPU from static
instanced attributes, so CPU cost per frame is a handful of uniform writes regardless of
particle count. Zones out of range are `visible = false` and cost nothing.

**Particle count is deliberately modest.** The wordmark covers only ~48k screen pixels at
1440p. Above roughly 20k particles the field is denser than the pixel grid and collapses
into flat vector type — indistinguishable from an `<h1>`, which defeats the point.
Fewer, brighter points that the eye integrates is the look; the bloom pass binds them
together. The `[textSampler]` log in development prints the coverage maths.

**The camera path is procedural.** Zones alternate sides as the camera travels down -Z
while the camera weaves the opposite way, so each structure arrives from one side of
frame and the copy takes the other. Two Catmull-Rom curves (position and look-target) at
low tension are what make the flight read as a camera move rather than a slideshow.

**Scroll is anchored to the DOM, not to document height.** Each section's *centre* is
pinned to its zone's control point and the path parameter is interpolated between them,
so a section can be any height it needs without the camera and the copy drifting apart.

**The hero copy is positioned against the 3D wordmark.** The scene reports how tall the
letterforms actually render (`--wordmark-h`), derived from the camera's real frustum, so
the HTML sits exactly against them at any window size instead of being eyeballed.

**Post-processing order matters.** Bloom runs before tone mapping (on HDR values, the
only place a threshold means anything); grain and vignette run after it, in display
space, where film grain behaves like film grain.

### Performance

Target was 60fps on a mid-range laptop. Measured on Intel Iris Xe integrated graphics at
1852×908 render resolution: **60fps idle, 59fps while scrolling**, at quality level 0
(no downgrades). Check your own machine with `?stats`.

What keeps it there:

- Everything is instanced; particle counts come from the render budget in
  `core/capabilities.ts`, never hardcoded.
- Rendering stops entirely when the tab is hidden.
- `core/perf.ts` watches real frame times and steps quality down if the device cannot
  hold the budget: pixel ratio first (the biggest fill-rate lever and the least visible
  on a soft-edged scene), then bloom, then field density. One-way by design —
  oscillating between two settings is more noticeable than sitting at the lower one.
- Every GPU resource is registered with a `Disposer` and released on teardown.

Production bundle (gzipped): 10KB JS + 6KB CSS + 83KB fonts on the critical path;
Three.js is a further 137KB, fetched only for the 3D path.

### Accessibility and SEO

- All content is real HTML text overlaid on the canvas. Nothing is rendered to a texture.
- In 3D mode the `<h1>` is visually hidden but present and crawlable; in flat mode it
  becomes the visible headline.
- Skip link, visible focus rings on every interactive element, semantic landmarks, and a
  `<noscript>` block with the core content and contact details.
- The project detail panels are real disclosures: always in the DOM (so they are
  crawlable and findable with the browser's own find-in-page), correct `aria-expanded`,
  no focus trap. The headline facts stay visible, so nothing has to be opened.
- `prefers-reduced-motion: reduce` serves the static 2D layout; `prefers-contrast: more`
  lifts the muted inks and hairlines; `forced-colors: active` drops the canvas and gives
  every control a real border.
- Person JSON-LD, Open Graph and Twitter cards, `robots.txt`.

---

## Build log

All seven steps complete.

- [x] 1 — Scaffold, core systems, resize/dispose handling, loading sequence
- [x] 2 — Hero: name-from-geometry, camera, post-processing, mouse parallax
- [x] 3 — Scroll system + camera path through zones, data-driven content overlay
- [x] 4 — Project zones, quick nav, project detail panels
- [x] 5 — Reduced-motion / mobile 2D fallback
- [x] 6 — Custom cursor, transitions, SEO/a11y pass
- [x] 7 — Performance pass (adaptive quality, profiling) + docs

### Not yet verified

The narrow-viewport layout (below 60rem — the horizontal nav rail, single-column panels)
is implemented but was not visually checked, because the browser in the build environment
would not shrink below ~1480px. Worth a look on a real phone before shipping.
