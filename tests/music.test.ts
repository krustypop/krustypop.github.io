import { expect, test } from 'bun:test';
import {
  CHORDS,
  compileHarmony,
  compileLead,
  hz,
  MELODY,
  midi,
  PROGRESSION,
  STEPS_PER_BAR,
} from '../src/audio/song.ts';

const TOKEN = /^([A-G](#|b)?\d|-):\d+$/;

test('one melody bar per chord', () => {
  expect(MELODY.length).toBe(PROGRESSION.length);
});

test('every chord in the progression is defined', () => {
  for (const name of PROGRESSION) expect(CHORDS[name]).toBeDefined();
});

test.each(MELODY.map((bar, i) => [i + 1, bar]))('bar %i lasts exactly 16 sixteenths', (_, bar) => {
  const tokens = bar.split(' ');
  for (const token of tokens) expect(token).toMatch(TOKEN);
  const length = tokens.reduce((sum, token) => sum + Number(token.split(':')[1]), 0);
  expect(length).toBe(STEPS_PER_BAR);
});

test('note names map to MIDI and concert pitch', () => {
  expect(midi('A4')).toBe(69);
  expect(midi('C4')).toBe(60);
  expect(midi('G#4')).toBe(68);
  expect(midi('Bb3')).toBe(58);
  expect(hz(69)).toBe(440);
});

test('the compiled lead keeps every note and drops rests', () => {
  const notes = MELODY.flatMap((bar) => bar.split(' ')).filter((t) => !t.startsWith('-'));
  expect(compileLead(MELODY).size).toBe(notes.length);
  expect(compileLead(['E5:4 -:12']).get(0)).toEqual({ midi: midi('E5'), length: 4 });
});

test('chord tones stack upward from the root', () => {
  for (const { bass, tones } of compileHarmony(PROGRESSION)) {
    expect(bass).toBeLessThan(tones[0]);
    for (let i = 1; i < tones.length; i++) expect(tones[i]).toBeGreaterThan(tones[i - 1]);
  }
});
