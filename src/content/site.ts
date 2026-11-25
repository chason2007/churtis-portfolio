import type { SiteContent } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ONLY FILE YOU NEED TO EDIT TO CHANGE CONTENT.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Add a project by appending to `projects` — the quick nav, the camera path,
 *  the 3D zone and the detail panel all derive from this array.
 *
 *  Everything here is taken from the "CHASON HURTIS" CV in Enhancv. When you
 *  update the CV, update this file to match; it is the one place the site
 *  reads copy from.
 *
 *  Anything marked `placeholder: true` or `// TODO:` is waiting on a real value.
 */
export const site: SiteContent = {
  meta: {
    title: 'Chason Hurtis — Software Developer',
    description:
      'Software developer and Computer Science student in Coimbatore, India, available in Abu Dhabi, UAE. Full-stack web apps end to end — MERN, Next.js, TypeScript, PostgreSQL.',
    url: 'https://churtis.vercel.app',
    // TODO: drop a 1200x630 PNG at public/og.png (a frame of the hero works well).
    ogImage: '/og.png',
    locale: 'en',
    author: 'Chason Hurtis',
  },

  hero: {
    name: 'CHASON HURTIS',
    role: 'Software Developer',
    tagline: 'Coimbatore · UAE Golden Visa holder · shipping production web apps end to end.',
    ctas: [
      { label: 'View Work', href: '#work' },
      // TODO: add your PDF at public/chason-hurtis-resume.pdf
      { label: 'Resume', href: '/chason-hurtis-resume.pdf', placeholder: true },
      { label: 'Contact', href: '#contact' },
    ],
  },

  about: {
    heading: 'About',
    lead: 'Computer Science and Engineering student and full-stack developer.',
    body: [
      'Comfortable across the MERN stack and Next.js. During a PropTech internship and on personal projects, I have shipped production web apps end to end — REST APIs, databases, and the front ends on top.',
      'I enjoy turning real-world problems into clean, working software.',
    ],
  },

  projects: [
    {
      id: 'jr-dream',
      index: '01',
      title: 'JR Dream',
      subtitle: 'PropTech Platform & Internal Tools',
      role: 'PropTech Engineering Intern',
      org: 'JR Dream',
      period: 'Dec 2025 – Jan 2026',
      blurb:
        'Took the company website from static HTML to a full MERN application, and built the internal tools the property teams run on.',
      body: [
        'Executed a comprehensive UI/UX redesign by transitioning the company website from static HTML to a modern MERN application — setting up the backend, developing the APIs, and setting up the database to improve user engagement.',
        'Built and maintained property-management applications in PHP, including survey apps, compliance checklist trackers, and an employee database.',
      ],
      highlights: [
        'Static HTML site → a full MERN application',
        'Backend, REST APIs and database set up from scratch',
        'PHP survey apps and compliance checklist trackers',
        'Internal employee database',
      ],
      stack: ['MongoDB', 'Express', 'React', 'Node', 'PHP'],
      links: [
        // TODO: live site URL
        { label: 'Live', href: '#', placeholder: true },
      ],
    },
    {
      id: 'sanad',
      index: '02',
      title: 'Sanad',
      subtitle: 'Multi-tenant Compliance SaaS',
      role: 'Solo build',
      period: 'May 2026',
      blurb:
        'Tracks document expiry for UAE companies and emails the right person before each deadline.',
      body: [
        'A multi-tenant SaaS that tracks document expiry — visas, trade licences, Emirates IDs — for UAE companies, and emails the right person before each deadline.',
        'Engineered tenant isolation with PostgreSQL row-level security, an idempotent alert engine that never double-sends, and AI-powered date extraction from uploaded scans.',
      ],
      highlights: [
        'Tenant isolation via PostgreSQL row-level security',
        'Idempotent alert engine that never double-sends',
        'AI date extraction from uploaded scans',
        'Stripe billing',
      ],
      stack: ['Next.js', 'TypeScript', 'Supabase', 'PostgreSQL', 'Stripe', 'Anthropic API'],
      links: [
        // TODO: GitHub repo URL
        { label: 'GitHub', href: '#', placeholder: true },
        // TODO: live demo URL
        { label: 'Live', href: '#', placeholder: true },
      ],
    },
    {
      id: 'worksync',
      index: '03',
      title: 'WorkSync',
      subtitle: 'Employee Management System',
      role: 'Solo build',
      period: 'Feb 2026',
      blurb: 'A MERN system for attendance, leave requests and administrative oversight.',
      body: [
        'A comprehensive employee management system streamlining attendance tracking, leave requests, and administrative oversight.',
      ],
      highlights: ['Attendance tracking', 'Leave requests', 'Administrative oversight'],
      stack: ['MongoDB', 'Express.js', 'React', 'Node.js'],
      links: [
        // TODO: GitHub repo URL
        { label: 'GitHub', href: '#', placeholder: true },
        // TODO: live demo URL
        { label: 'Demo', href: '#', placeholder: true },
      ],
    },
    {
      id: 'breakeven',
      index: '04',
      title: 'Breakeven',
      subtitle: 'Rent vs Buy Calculator',
      role: 'Solo build',
      period: 'Nov 2026',
      blurb: 'Compares the true cost of renting versus buying a home in the UAE.',
      body: [
        'A Next.js tool that compares the true cost of renting versus buying a home in the UAE, calculating the breakeven year and the total cost of each option.',
      ],
      highlights: ['Breakeven year for any property', 'Total cost of each option, side by side'],
      stack: ['Next.js', 'TypeScript', 'React'],
      links: [
        // TODO: GitHub repo URL
        { label: 'GitHub', href: '#', placeholder: true },
        // TODO: live demo URL
        { label: 'Live', href: '#', placeholder: true },
      ],
    },
    // TODO: add more projects here — everything else updates automatically.
  ],

  skills: {
    heading: 'Skills',
    groups: [
      { label: 'Languages', items: ['Python', 'Java', 'JavaScript', 'C', 'C++'] },
      { label: 'Frameworks & Libraries', items: ['React', 'Node.js', 'Express.js', 'Next.js'] },
      { label: 'Databases', items: ['SQL', 'MongoDB', 'PostgreSQL'] },
      {
        label: 'Tools',
        items: [
          'Git',
          'Adobe Photoshop',
          'Illustrator',
          'Animate',
          'Microsoft Office (Word / Excel / Access)',
        ],
      },
      { label: 'Concepts', items: ['RESTful APIs', 'Agile'] },
      {
        label: 'Soft Skills',
        items: [
          'Problem-solving',
          'Teamwork',
          'Adaptability',
          'Communication',
          'Critical Thinking',
        ],
      },
    ],
  },

  background: {
    heading: 'Background',
    education: [
      {
        degree: 'Bachelor of Engineering',
        institution: 'Sri Eshwar College of Engineering',
        note: 'Affiliated to Anna University, Chennai',
        location: 'Coimbatore, Tamil Nadu, India',
        period: 'Sep 2024 – May 2028',
        details: ['Major in Computer Science and Engineering', 'CGPA 7.32 (as of 3rd semester)'],
      },
      {
        degree: 'AS & A Levels',
        institution: 'Merryland International School',
        location: 'Abu Dhabi, UAE',
        period: 'May 2024',
        details: ['UAE Golden Visa recipient — Distinction Student'],
      },
    ],
    certifications: [
      { title: 'Mastering DSA Using C/C++', issuer: 'Udemy' },
      { title: 'C & C++ Training', issuer: 'IIT Bombay' },
    ],
    languages: [
      { name: 'English', level: 'Proficient' },
      { name: 'German', level: 'Beginner' },
      { name: 'Hindi', level: 'Beginner' },
      { name: 'Tamil', level: 'Beginner' },
    ],
  },

  contact: {
    heading: 'Contact',
    lead: 'Open to software roles and interesting work on the web.',
    email: 'chase.hurtis@gmail.com',
    // Remove this field if you would rather not publish a number.
    phone: '+91 74183 52415',
    locations: ['Coimbatore, India', 'Abu Dhabi, UAE'],
    links: [
      { label: 'Email', href: 'mailto:chase.hurtis@gmail.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/chason-hurtis-666662328' },
      { label: 'GitHub', href: 'https://github.com/chason2007' },
    ],
  },
};
