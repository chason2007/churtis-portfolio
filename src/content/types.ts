/**
 * Content types.
 *
 * Everything the site displays is typed here and supplied from `site.ts`.
 * Nothing in `scene/` or `ui/` hardcodes copy — add a project to the array in
 * `site.ts` and a 3D zone, a nav entry and a detail panel appear automatically.
 *
 * The shape mirrors the structure of the CV this content is drawn from:
 * a summary, one professional role, a set of projects, skills by group, and
 * education / certifications / languages.
 */

export interface Link {
  label: string;
  /** Absolute URL, or `mailto:` / `#anchor`. */
  href: string;
  /** TODO markers: set `false` once you have the real URL so the link renders live. */
  placeholder?: boolean;
}

export interface Project {
  /** Stable slug — used for the URL hash, nav anchors and the 3D zone id. */
  id: string;
  /** Two-digit index shown in the nav and zone label, e.g. "01". */
  index: string;
  title: string;
  subtitle: string;
  /** Job title for professional work, or how the project was built. */
  role: string;
  /**
   * Employer, for professional work. Omitted for personal projects, where the
   * title already names the thing.
   */
  org?: string;
  /** Human-readable period, e.g. "Dec 2025 – Jan 2026". */
  period?: string;
  /** Single-sentence hook shown in the zone as the camera arrives. */
  blurb: string;
  /** Longer copy for the detail panel. One string per paragraph. */
  body: string[];
  /** Short, scannable outcomes. Optional. */
  highlights?: string[];
  stack: string[];
  links: Link[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  /** Awarding body or similar qualifier, shown smaller. */
  note?: string;
  location?: string;
  period: string;
  details?: string[];
}

export interface Certification {
  title: string;
  issuer: string;
}

export interface SpokenLanguage {
  name: string;
  /** Beginner / Intermediate / Advanced / Proficient / Native. */
  level: string;
}

export interface SiteContent {
  meta: {
    title: string;
    description: string;
    url: string;
    ogImage: string;
    locale: string;
    author: string;
  };
  hero: {
    /** Rendered as particles in 3D, and as a real <h1> for a11y/SEO. */
    name: string;
    role: string;
    tagline: string;
    ctas: Link[];
  };
  about: {
    heading: string;
    lead: string;
    body: string[];
  };
  projects: Project[];
  skills: {
    heading: string;
    groups: SkillGroup[];
  };
  background: {
    heading: string;
    education: EducationEntry[];
    certifications: Certification[];
    languages: SpokenLanguage[];
  };
  contact: {
    heading: string;
    lead: string;
    email: string;
    /** Shown beside the email. Remove the field to keep it off a public page. */
    phone?: string;
    /**
     * Where you are available to work. Shown under the email and in the
     * corner chrome, and used for the Person schema's addresses.
     */
    locations: string[];
    links: Link[];
  };
}
