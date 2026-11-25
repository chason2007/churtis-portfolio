import './styles/main.css';

import { buildOutline, type OutlineEntry } from './content/outline';
import { detectCapabilities, type Capabilities } from './core/capabilities';
import { ScrollDriver } from './core/scroll';
import { Ambient } from './ui/Ambient';
import { Cursor } from './ui/Cursor';
import { applyContent } from './ui/content';
import { Hero } from './ui/Hero';
import { Loader } from './ui/Loader';
import { Nav } from './ui/Nav';
import { Sections } from './ui/Sections';
import { maybe } from './ui/dom';

/**
 * Entry point.
 *
 * Deliberately small, and the only module that knows about the whole app. Its
 * job is to decide *what kind of site this visitor gets* before anything heavy
 * is downloaded, then drive the boot sequence:
 *
 *   capability check → content → fonts → [3D chunk] → first frame → reveal
 *
 * Three.js is behind a dynamic import, so a phone, a software rasteriser or a
 * visitor who asked for reduced motion never pays for it.
 */

/** Where the loader's progress bar sits at each boot milestone. */
const STEP = {
  start: 0.06,
  content: 0.2,
  fonts: 0.36,
  chunk: 0.56,
  scene: 0.84,
  frame: 0.97,
} as const;

async function boot(): Promise<void> {
  const html = document.documentElement;

  // Tells CSS that JS is alive and may hide things it intends to animate in.
  // If the bundle fails to load this never runs and the page stays fully visible.
  html.dataset.anim = 'on';

  // The opening is a timed sequence; starting it half way down the page because
  // the browser restored a scroll position would ruin it.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // Strip the fragment before anything else. The sections it points at are
  // created by JS, and Chrome re-applies its scroll-to-fragment when the target
  // finally appears — which lands on top of our own jump and doubles the offset.
  // The hash is put back once we have scrolled there ourselves.
  const entryHash = window.location.hash.slice(1);
  if (entryHash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.scrollTo(0, 0);

  const loader = new Loader();
  loader.set(STEP.start, 'Initialising');

  const capabilities = detectCapabilities();
  html.dataset.mode = capabilities.use3D ? '3d' : 'flat';
  if (capabilities.reducedMotion) html.dataset.reducedMotion = 'true';

  if (import.meta.env.DEV) {
    console.info('[boot] capabilities', capabilities);
  }

  // Bind the hero copy, then build every section below it from site.ts.
  applyContent(document);
  const outline = buildOutline();
  const sections = new Sections(outline);
  const sectionElements = sections.render();
  loader.set(STEP.content, 'Loading type');

  // Both faces are self-hosted and in the critical CSS, so this is quick — but
  // the wordmark is rasterised from the display face, so it must be resident.
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      /* A font failure is cosmetic; carry on with the fallback stack. */
    }
  }
  loader.set(STEP.fonts, 'Preparing scene');

  const hero = new Hero({ reducedMotion: capabilities.reducedMotion });
  // Fetch the reveal animation now so it is resident before the scene's intro
  // timeline starts. GSAP rides along with it, off the critical path.
  await hero.prepare();

  const finish = async (scroll: ScrollDriver): Promise<void> => {
    // The nav needs the scroll driver to move the page, so it is wired here
    // rather than at render time.
    wireNav(outline, scroll, html);
    wireControls();

    await loader.finish();
    html.dataset.boot = 'ready';

    // The document is now its full height and the overflow lock is off.
    scroll.refresh();

    if (entryHash) {
      scroll.scrollTo(entryHash, { immediate: true });
      history.replaceState(null, '', `#${entryHash}`);
    }
  };

  if (!capabilities.use3D) {
    await bootFlat(hero, sectionElements, finish);
    return;
  }

  try {
    await boot3D(loader, hero, capabilities, sectionElements, finish);
  } catch (error) {
    // A WebGL failure must never cost the visitor the content. Fall back to the
    // flat layout and carry on.
    console.error('[boot] 3D experience failed to start — falling back to the flat layout', error);
    html.dataset.mode = 'flat';
    html.removeAttribute('data-stage');
    maybe('#stage')?.remove();
    await bootFlat(hero, sectionElements, finish);
  }
}

type Finish = (scroll: ScrollDriver) => Promise<void>;

/**
 * Mount the quick nav and keep it in step with the scroll position.
 *
 * Also publishes the active section onto the root element, which is how the
 * CSS knows to retire the scroll cue once the hero is behind us.
 */
function wireNav(outline: OutlineEntry[], scroll: ScrollDriver, html: HTMLElement): void {
  const nav = new Nav({
    outline,
    onNavigate: (id) => scroll.scrollTo(id),
  });
  nav.mount();

  scroll.on((state) => {
    const entry = outline[state.nearest];
    if (!entry) return;
    nav.setActive(entry.id);
    html.dataset.zone = entry.id;
    html.dataset.atTop = state.nearest === 0 ? 'true' : 'false';
  });
}

/**
 * Ambient audio and the custom cursor.
 *
 * Both are strictly optional decoration. The audio is off until asked for and
 * its AudioContext is not constructed until then; the cursor only mounts for a
 * fine pointer with motion allowed.
 */
function wireControls(): void {
  const toggle = maybe<HTMLButtonElement>('#audio-toggle');
  if (toggle) {
    const ambient = new Ambient();
    // The click is the user gesture browsers require before audio may start.
    toggle.addEventListener('click', () => {
      void ambient.toggle().then((playing) => {
        toggle.setAttribute('aria-pressed', String(playing));
      });
    });
  }

  new Cursor().mount();
}

/** The 2D path: no canvas, no Three.js, native scrolling, same content. */
async function bootFlat(hero: Hero, sections: HTMLElement[], finish: Finish): Promise<void> {
  // Nothing will ever draw into it, so take it out of the DOM rather than
  // leaving an empty compositing layer behind.
  maybe('#stage')?.remove();

  // Still worth running: the nav rail reads the active section from it. Smooth
  // scrolling stays off — the browser's own is the right behaviour here, and is
  // exactly what a reduced-motion visitor asked for.
  const scroll = new ScrollDriver({ sections });

  await finish(scroll);
  hero.reveal();
}

/** The 3D path. */
async function boot3D(
  loader: Loader,
  hero: Hero,
  capabilities: Capabilities,
  sections: HTMLElement[],
  finish: Finish,
): Promise<void> {
  const canvas = maybe<HTMLCanvasElement>('#stage');
  if (!canvas) throw new Error('[boot] #stage canvas is missing from the markup');

  loader.set(STEP.chunk, 'Compiling shaders');

  // Code-split: this is the only place Three.js enters the graph.
  const { Experience } = await import('./scene/Experience');

  // Resolved by the Experience the moment a frame has actually reached the
  // screen — the only honest definition of "loaded" for a 3D scene.
  let onFirstFrame: () => void = () => undefined;
  const firstFrame = new Promise<void>((resolve) => {
    onFirstFrame = resolve;
  });

  const experience = new Experience({
    canvas,
    capabilities,
    onFirstFrame: () => onFirstFrame(),
    // The scene is the only thing that knows how tall the wordmark renders, so
    // it reports back and the hero's CSS positions its copy against the letters.
    onFraming: (ratio) => {
      document.documentElement.style.setProperty('--wordmark-h', `${(ratio * 100).toFixed(3)}vh`);
    },
  });

  loader.set(STEP.chunk, 'Sampling glyphs');
  await experience.init();
  loader.set(STEP.scene, 'Lighting the scene');

  // Scroll drives the camera. Both run off the Experience's ticker so the whole
  // app still has exactly one requestAnimationFrame loop.
  const scroll = new ScrollDriver({ sections });
  // Smooth scrolling keeps gliding after the wheel stops, which is exactly the
  // kind of momentum reduced motion is asking us not to add. The camera still
  // follows the scroll — it just tracks it exactly.
  if (!capabilities.reducedMotion) await scroll.enableSmooth();
  scroll.on((state) => experience.setScroll(state.t));
  experience.ticker.add((delta) => {
    scroll.raf(performance.now());
    scroll.update(delta);
  });

  experience.start();
  await firstFrame;

  loader.set(STEP.frame);
  document.documentElement.dataset.stage = 'ready';

  await finish(scroll);

  // The signature moment. The hero copy is nested into the scene's timeline so
  // the type arrives as the letterforms settle, not before.
  const intro = experience.playIntro();
  hero.reveal(intro);

  if (import.meta.env.DEV) {
    // Handy for tuning: `window.__experience.playIntro()` replays the reveal.
    Object.assign(window, { __experience: experience, __scroll: scroll });
  }
}

void boot();
