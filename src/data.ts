// CV content. Experiences are in chronological order:
// the first stands at the start of the avenue, the most recent at the end.

export const profile = {
  name: 'Arnaud Polette',
  title: 'Senior Software Engineer',
  tagline: 'Every building on this avenue is a step in my career. Step inside and explore them.',
  avatar: { skin: '#f1c9a0', hair: '#3b2a1a', shirt: '#2f6fed', pants: '#23262f', shoes: '#15161a' },
  // The family home waits on the avenue, in the gap past the job held that year.
  family: { firstChild: 2023 },
  contact: {
    message: 'Fancy a chat? Drop me a line, I answer quickly.',
    links: [
      { label: 'Email', url: 'mailto:arnaud.polette@gmail.com' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/arnaud-polette' },
    ],
  },
} as const;

export type Profile = typeof profile;

// Rooftop prop of a building (see world/emblems.ts).
export type Emblem = 'cap' | 'clock' | 'bag' | 'house' | 'octagon' | 'coin' | 'device';

export interface Experience {
  company: string;
  role: string;
  start: string;
  end: string;
  location?: string;
  color: string;
  floors?: number;
  emblem?: Emblem;
  summary: string;
  highlights: readonly string[];
  stack: readonly string[];
  // Thought shown while sitting on the bench across the street.
  anecdote?: string;
}

// Anecdotes are drafts built from the facts above, for Arnaud to rewrite.
export const experiences: readonly Experience[] = [
  {
    company: 'Efficom',
    role: 'Associate degree (BTS)',
    start: '2007',
    end: '2009',
    location: 'Paris',
    color: '#7a8fb3',
    floors: 2,
    emblem: 'cap',
    summary: 'School days in Paris, before diving into the web.',
    highlights: [],
    stack: [],
    anecdote: 'Two years at Efficom, in Paris. That’s where I learned the basics, before diving into the web for good.',
  },
  {
    company: 'Optimind',
    role: 'Junior web developer',
    start: '2010',
    end: '2012',
    location: 'Paris',
    color: '#4f9d8f',
    emblem: 'clock',
    summary: 'First professional steps: the company’s internal platform and its public website.',
    highlights: [
      'Modules for time off, consultant timesheets and invoicing',
      'Reporting',
      'Maintenance and new features for the public website',
    ],
    stack: ['PHP', 'JavaScript', 'SQL'],
    anecdote:
      'My first dev job: the internal tools the company used every day, from time off to invoicing. My first users were my colleagues.',
  },
  {
    company: 'BrandAlley',
    role: 'Full-stack developer',
    start: '2012',
    end: '2016',
    location: 'Paris',
    color: '#c8503f',
    floors: 4,
    emblem: 'bag',
    summary: 'Online flash sales: improving the experience and visibility of the brandalley.com e-commerce site.',
    highlights: ['New features to improve the site’s UX/UI', 'SEO: tagging plan and semantic HTML'],
    stack: ['PHP', 'JavaScript', 'SQL'],
    anecdote:
      'Four years in online flash sales. BrandAlley taught me that on an e-commerce site, every UX detail and every well-chosen tag counts.',
  },
  {
    company: 'Squarebreak / Onefinestay',
    role: 'Front-end developer',
    start: '2016',
    end: '2019',
    location: 'Paris',
    color: '#d9a441',
    floors: 4,
    emblem: 'house',
    summary: 'An internal platform to run the day-to-day of a luxury rental service.',
    highlights: ['Customer management', 'Property management: availability, owners and managers', 'Booking management'],
    stack: ['Angular', 'React'],
    anecdote:
      'The day-to-day of a luxury rental service ran through the tool I was building: customers, properties, availability, bookings.',
  },
  {
    company: 'Domo',
    role: 'Lead front-end developer',
    start: '2019',
    end: '2020',
    location: 'Paris',
    color: '#6f7fd1',
    floors: 5,
    emblem: 'octagon',
    summary: 'Connected hospitality: business and hotel tools around the octagons, the in-house devices.',
    highlights: [
      'Back office: customers, apps installable on the octagons, scheduling of the “pushes” shown in guest rooms',
      'Web app for hoteliers to manage their fleet of octagons',
      'Public website domo.ki',
    ],
    stack: ['React'],
    anecdote:
      'My first front-end lead role. Our octagons displayed “pushes” in hotel rooms, and I built the tools to run them.',
  },
  {
    company: 'Klub',
    role: 'Lead front-end developer',
    start: '2020',
    end: '2025',
    location: 'Paris',
    color: '#8a6fc4',
    floors: 7,
    emblem: 'coin',
    summary: 'Crypto and Web3: websites, web and mobile apps, a decentralized exchange, from design to production.',
    highlights: [
      'Public website klub.ki and decentralized exchange atlas.ki',
      '“Pay2earn” app cosmon.ki and the Klub mobile app',
      'The company’s internal back office',
      'Vue.js + Electron desktop client to manage crypto wallets',
      'Code review, architecture, shared components and typings with the front-end team',
      'Close collaboration with the product and UX/UI teams',
    ],
    stack: ['TypeScript', 'React', 'React Native', 'Vue.js', 'Electron'],
    anecdote:
      'Five years deep in Web3: websites, web and mobile apps, a decentralized exchange, from design to production, hand in hand with product and UX/UI.',
  },
  {
    company: 'Ledger',
    role: 'Senior Software Engineer',
    start: '2025',
    end: 'Present',
    location: 'Paris',
    color: '#e2673f',
    floors: 8,
    emblem: 'device',
    summary: 'Crypto products for businesses, and setting up AI workflows.',
    highlights: [
      'Ledger Multisig: designing the product from 0 to 1',
      'Ledger Enterprise (enterprise.ledger.com): many product improvements',
      'AI workflows and harness engineering',
    ],
    stack: ['TypeScript', 'React', 'AI'],
    anecdote:
      'Now at Ledger: building Ledger Multisig from 0 to 1, growing Ledger Enterprise, exploring AI workflows. The rest of the avenue is yet to be written.',
  },
];
