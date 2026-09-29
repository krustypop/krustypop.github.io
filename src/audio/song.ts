// The looping chiptune, as data. Pure: no Web Audio here, so it can be tested.

export const BPM = 112;
export const STEP = 60 / BPM / 4; // one 16th note, in seconds
export const STEPS_PER_BAR = 16;

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name: string): number {
  const [, letter, accidental, octave] = name.match(/^([A-G])(#|b)?(\d)$/)!;
  return 12 * (Number(octave) + 1) + NOTE[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}

export const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export const CHORDS: Record<string, string[]> = {
  Am: ['A', 'C', 'E'],
  F: ['F', 'A', 'C'],
  C: ['C', 'E', 'G'],
  G: ['G', 'B', 'D'],
  E: ['E', 'G#', 'B'],
  Em: ['E', 'G', 'B'],
  Dm: ['D', 'F', 'A'],
};
export const PROGRESSION = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E'];
// One bar per line, "note:length" in 16th notes, "-" for a rest.
export const MELODY = [
  'E5:4 A4:2 C5:2 E5:2 D5:2 C5:2 B4:2',
  'A4:6 C5:2 F5:4 E5:2 D5:2',
  'E5:4 G5:2 E5:2 C5:4 D5:2 E5:2',
  'D5:6 B4:2 G4:4 -:4',
  'E5:4 A4:2 C5:2 E5:2 A5:2 G5:2 E5:2',
  'F5:4 E5:2 D5:2 C5:4 A4:4',
  'B4:4 D5:2 G5:2 F5:2 E5:2 D5:2 B4:2',
  'G#4:4 B4:4 E5:6 -:2',
  'C5:2 F5:2 A5:4 G5:2 F5:2 E5:4',
  'D5:2 G5:2 B5:4 A5:2 G5:2 D5:4',
  'E5:4 G5:4 B5:4 A5:2 G5:2',
  'A5:8 E5:4 C5:4',
  'D5:2 F5:2 A5:4 C6:4 A5:4',
  'B5:4 G5:2 D5:2 G5:4 B5:4',
  'C6:4 B5:2 A5:2 G5:4 E5:4',
  'G#5:4 E5:4 B4:4 -:4',
];

export interface LeadNote {
  midi: number;
  length: number;
}

export interface BarHarmony {
  bass: number;
  tones: number[];
}

export const BASS_PATTERN = [0, 12, 0, 12, 7, 12, 0, 12]; // semitones above the root, one per 8th
export const ARP_PATTERN = [0, 1, 2, 1]; // chord-tone indexes, one per 16th
export const KICKS = new Set([0, 6, 8]);
export const SNARES = new Set([4, 12]);
export const FILL_BAR = 7; // every 8th bar ends with a snare roll

/** Melody as step → note, so the sequencer only looks up the current step. */
export function compileLead(melody: string[]): Map<number, LeadNote> {
  const lead = new Map<number, LeadNote>();
  melody.forEach((bar, b) => {
    let step = b * STEPS_PER_BAR;
    for (const token of bar.split(' ')) {
      const [note, len] = token.split(':');
      if (note !== '-') lead.set(step, { midi: midi(note), length: Number(len) });
      step += Number(len);
    }
  });
  return lead;
}

/** Per bar: bass root (octave 2) and chord tones stacked upward from octave 4. */
export function compileHarmony(progression: string[]): BarHarmony[] {
  return progression.map((name) => {
    const [root, ...rest] = CHORDS[name];
    const base = midi(`${root}4`);
    const tones: number[] = [base];
    for (const n of rest) {
      let m = midi(`${n}4`);
      while (m <= base) m += 12;
      tones.push(m);
    }
    return { bass: midi(`${root}2`), tones };
  });
}
