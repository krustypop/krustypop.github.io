import type { experiences as allExperiences, profile as cvProfile } from '../data.ts';
import { esc } from '../utils/dom.ts';

export type Profile = typeof cvProfile;
export type Experience = (typeof allExperiences)[number];

// Every value from data.ts goes through esc(): the CV is authored text, never markup.

const period = (exp: Experience) =>
  `${esc(exp.start)} – ${esc(exp.end)}${exp.location ? ` · ${esc(exp.location)}` : ''}`;

const list = (items: readonly string[] | undefined, cls: string) =>
  items?.length ? `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';

const section = (title: string, items: readonly string[] | undefined, cls: string) =>
  items?.length ? `<h3>${title}</h3>${list(items, cls)}` : '';

const header = (kicker: string, title: string, subtitle: string, color?: string) => `
  <header class="sheet-head"${color ? ` style="--c:${esc(color)}"` : ''}>
    <p class="kicker">${kicker}</p>
    <h2>${esc(title)}</h2>
    <p class="role">${esc(subtitle)}</p>
  </header>`;

const links = ({ links: items }: Profile['contact']) =>
  `<div class="links">${items
    .map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
    .join('')}</div>`;

export const experienceHTML = (exp: Experience) => `
  ${header(period(exp), exp.company, exp.role)}
  <div class="sheet-body">
    <p>${esc(exp.summary)}</p>
    ${section('Highlights', exp.highlights, 'bullets')}
    ${section('Stack', exp.stack, 'chips')}
  </div>`;

export const contactHTML = (profile: Profile) => `
  ${header('End of the avenue', 'Contact', profile.name)}
  <div class="sheet-body">
    <p>${esc(profile.contact.message)}</p>
    ${links(profile.contact)}
  </div>`;

const cvItem = (exp: Experience) => `
  <section class="cv-item" style="--c:${esc(exp.color)}">
    <p class="kicker">${period(exp)}</p>
    <h3>${esc(exp.company)} <span>— ${esc(exp.role)}</span></h3>
    <p>${esc(exp.summary)}</p>
    ${list(exp.highlights, 'bullets')}
    ${list(exp.stack, 'chips')}
  </section>`;

// Plain-text CV, most recent job first.
export const cvHTML = (profile: Profile, experiences: readonly Experience[]) => `
  ${header('Curriculum vitae', profile.name, profile.title, '#1d1f24')}
  <div class="sheet-body">
    <p>${esc(profile.tagline)}</p>
    <h3>Experience</h3>
    ${experiences.toReversed().map(cvItem).join('')}
    <h3>Contact</h3>
    <p>${esc(profile.contact.message)}</p>
    ${links(profile.contact)}
  </div>`;
