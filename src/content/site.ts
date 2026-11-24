import type { SiteContent } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ONLY FILE YOU NEED TO EDIT TO CHANGE CONTENT.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Add a project by appending to `projects` — the quick nav, the camera path,
 *  the 3D zone and the detail panel all derive from this array.
 *
 *  Anything marked `placeholder: true` or `// TODO:` is waiting on a real value.
 */
export const site: SiteContent = {
  meta: {
    title: 'Chason Hurtis — Full-Stack Software Developer',
    description:
      'Full-stack software developer in Abu Dhabi. Production web apps end to end — Next.js, TypeScript, Azure, MERN. Background in cinematic web: WebGL, GLSL, canvas.',
    // TODO: replace with your real deployed origin (used for canonical + OG URLs).
    url: 'https://chasonhurtis.com',
    // TODO: drop a 1200x630 PNG at public/og.png (a frame of the hero works well).
    ogImage: '/og.png',
    locale: 'en',
    author: 'Chason Hurtis',
  },

  hero: {
    name: 'CHASON HURTIS',
    role: 'Full-Stack Software Developer',
    tagline: 'Abu Dhabi · UAE Golden Visa holder · building production software end to end.',
    ctas: [
      { label: 'View Work', href: '#work' },
      // TODO: add your PDF at public/chason-hurtis-resume.pdf
      { label: 'Resume', href: '/chason-hurtis-resume.pdf', placeholder: true },
      { label: 'Contact', href: '#contact' },
    ],
  },

  about: {
    heading: 'About',
    lead: 'Full-stack developer and Computer Science student.',
    body: [
      'I ship production web apps end to end — currently leading a company-wide platform rebuild at JR Dream on Next.js + TypeScript and Microsoft Azure (secure auth, compliant data layer, REST APIs over a legacy system).',
      'Comfortable across the MERN stack, Python, and cloud. Background in cinematic web (WebGL, GLSL shaders, canvas).',
    ],
  },

  projects: [
    {
      id: 'jr-dream',
      index: '01',
      title: 'JR Dream',
      subtitle: 'Platform & Digital Transformation',
      role: 'Full-Stack Developer',
      blurb:
        'Led a company-wide migration from a static site to a typed Next.js platform on Azure.',
      body: [
        'Led migration from a static site to a Next.js + TypeScript + Tailwind platform on Azure Static Web Apps.',
        'Built a compliant data layer on Azure Database for MySQL, a secure client portal with Microsoft Entra External ID, and a thin PHP JSON API over a legacy ERP.',
      ],
      highlights: [
        'Static site → typed, server-rendered platform',
        'Compliant data layer on Azure Database for MySQL',
        'Client portal secured with Microsoft Entra External ID',
        'Thin PHP JSON API fronting a legacy ERP',
      ],
      stack: ['Next.js', 'TypeScript', 'Azure', 'MySQL', 'PHP'],
      links: [
        // TODO: live site URL
        { label: 'Live', href: '#', placeholder: true },
        // TODO: case study URL or write-up
        { label: 'Case study', href: '#', placeholder: true },
      ],
    },
    {
      id: 'worksync',
      index: '02',
      title: 'WorkSync',
      subtitle: 'Employee Management System',
      role: 'Full-Stack Developer',
      blurb:
        'A full-stack MERN system for attendance, leave and admin oversight, with real RBAC.',
      body: [
        'Full-stack MERN app for attendance, leave, and admin oversight with role-based access control (RBAC) and a notification system.',
      ],
      highlights: [
        'Attendance and leave workflows',
        'Role-based access control across employee / manager / admin',
        'Notification system for request state changes',
      ],
      stack: ['MongoDB', 'Express', 'React', 'Node'],
      links: [
        // TODO: GitHub repo URL
        { label: 'GitHub', href: '#', placeholder: true },
        // TODO: live demo URL
        { label: 'Demo', href: '#', placeholder: true },
      ],
    },
    {
      id: 'quicklist',
      index: '03',
      title: 'QuickList',
      subtitle: 'Voice-to-Text Checklist',
      role: 'Developer',
      blurb: 'Create and manage to-do lists by speaking — a study in real-time browser APIs.',
      body: [
        'Create and manage to-do lists by speaking, built on the Web Speech API; focus on real-time browser-API integration.',
      ],
      highlights: [
        'Continuous speech recognition with interim results',
        'Command grammar for add / complete / clear',
        'Zero-dependency front end',
      ],
      stack: ['JavaScript', 'Tailwind', 'Web Speech API'],
      links: [
        // TODO: GitHub repo URL
        { label: 'GitHub', href: '#', placeholder: true },
        // TODO: live demo URL
        { label: 'Demo', href: '#', placeholder: true },
      ],
    },
    // TODO: add more projects here — everything else updates automatically.
  ],

  skills: {
    heading: 'Skills',
    groups: [
      { label: 'Frontend', items: ['React', 'Next.js', 'TypeScript', 'Tailwind'] },
      { label: 'Backend', items: ['Node', 'Express', 'PHP', 'REST APIs'] },
      { label: 'Databases', items: ['MongoDB', 'MySQL'] },
      { label: 'Cloud', items: ['Azure'] },
      { label: 'Languages', items: ['Python', 'C / C++', 'Java', 'JS / TS'] },
      { label: 'Creative', items: ['WebGL', 'GLSL shaders', 'Canvas'] },
    ],
  },

  contact: {
    heading: 'Contact',
    lead: 'Open to full-stack roles and interesting work on the web.',
    email: 'chase.hurtis@gmail.com',
    availability: 'Available immediately in Abu Dhabi — no visa sponsorship required.',
    links: [
      { label: 'Email', href: 'mailto:chase.hurtis@gmail.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/chasonhurtis-666662328' },
      // TODO: GitHub profile URL
      { label: 'GitHub', href: '#', placeholder: true },
    ],
  },
};
