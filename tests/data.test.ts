import { describe, expect, test } from 'bun:test';
import { experiences, profile } from '../src/data.ts';

const HEX = /^#[0-9a-f]{6}$/i;
// A non-numeric end ("Present") means the job is ongoing.
const year = (v: string) => (/^\d{4}$/.test(v) ? Number(v) : Infinity);
const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

describe('profile', () => {
  test('has the text shown on the start screen and arch', () => {
    for (const key of ['name', 'title', 'tagline'] as const) expect(filled(profile[key])).toBe(true);
  });

  test('avatar colors are hex', () => {
    for (const part of ['skin', 'hair', 'shirt', 'pants', 'shoes'] as const) expect(profile.avatar[part]).toMatch(HEX);
  });

  test('contact links are absolute', () => {
    expect(filled(profile.contact.message)).toBe(true);
    for (const link of profile.contact.links) {
      expect(filled(link.label)).toBe(true);
      expect(link.url).toMatch(/^(https:\/\/|mailto:)/);
    }
  });
});

describe('experiences', () => {
  test('there is at least one building', () => {
    expect(experiences.length).toBeGreaterThan(0);
  });

  test.each(experiences.map((e) => [e.company, e]))('%s is complete', (_, exp) => {
    for (const key of ['company', 'role', 'start', 'end', 'summary'] as const) expect(filled(exp[key])).toBe(true);
    expect(exp.color).toMatch(HEX);
    expect(year(exp.start)).toBeLessThanOrEqual(year(exp.end));
    if (exp.floors !== undefined) {
      expect(Number.isInteger(exp.floors)).toBe(true);
      expect(exp.floors).toBeWithin(1, 9);
    }
    for (const list of [exp.highlights, exp.stack]) {
      if (list !== undefined) expect(list.every(filled)).toBe(true);
    }
  });

  // Short enough to type out in the bench's thought bubble.
  test.each(experiences.map((e) => [e.company, e]))('%s anecdote fits the bubble', (_, exp) => {
    if (exp.anecdote === undefined) return;
    expect(filled(exp.anecdote)).toBe(true);
    expect(exp.anecdote.length).toBeLessThanOrEqual(220);
  });

  test('are in chronological order (the avenue is a timeline)', () => {
    const starts = experiences.map((e) => year(e.start));
    expect(starts).toEqual(starts.toSorted((a, b) => a - b));
  });
});
