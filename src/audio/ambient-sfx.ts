import type { Emblem } from '../data.ts';
import type { Cadence } from './ambience.ts';
import { hz } from './song.ts';
import type { Synth } from './synth.ts';

export type Voices = Pick<Synth, 'tone' | 'noise' | 'waves'>;

/** One sparse one-shot: `vol` already includes the distance or day/night gain. */
export type AmbientPlayer = (v: Voices, dest: AudioNode, t: number, vol: number, rand: () => number) => void;

export interface Ambience {
  cadence: Cadence;
  play: AmbientPlayer;
}

const DTMF = [1209, 1336, 1477, 1633];

const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

// A burst of short noise clicks with irregular spacing (chalk, keyboard).
function taps(
  { noise }: Voices,
  dest: AudioNode,
  t: number,
  {
    count,
    gap,
    f,
    q,
    vol,
    rand,
  }: { count: number; gap: [number, number]; f: number; q: number; vol: number; rand: () => number },
) {
  let at = t;
  for (let i = 0; i < count; i++) {
    noise(dest, {
      t: at,
      dur: 0.025,
      vol: vol * between(rand, 0.6, 1),
      type: 'bandpass',
      f: f * between(rand, 0.85, 1.15),
      q,
    });
    at += between(rand, ...gap);
  }
}

function ding({ tone }: Voices, dest: AudioNode, t: number, midi: number, vol: number, ring = 0.8) {
  tone(dest, { type: 'triangle', f: hz(midi), t, dur: 0.02, vol, release: ring });
  // Inharmonic partial is what makes it read as metal rather than a synth beep.
  tone(dest, { type: 'sine', f: hz(midi) * 2.76, t, dur: 0.01, vol: vol * 0.3, release: ring * 0.4 });
}

export const PLACE_AMBIENCE: Record<Emblem, Ambience> = {
  // School: chalk on the board, now and then a distant bell.
  cap: {
    cadence: { min: 3, max: 7 },
    play(v, dest, t, vol, rand) {
      if (rand() < 0.2) {
        for (let i = 0; i < 16; i++) {
          v.tone(dest, { type: 'triangle', f: 1180, t: t + i * 0.035, dur: 0.02, vol: vol * 0.05, release: 0.01 });
        }
        return;
      }
      taps(v, dest, t, { count: 3 + Math.floor(rand() * 3), gap: [0.12, 0.28], f: 3200, q: 4, vol: vol * 0.12, rand });
    },
  },

  // Office with time sheets: a wall clock and bursts of typing.
  clock: {
    cadence: { min: 2.5, max: 5 },
    play(v, dest, t, vol, rand) {
      for (let i = 0; i < 4; i++) {
        v.tone(dest, {
          type: 'triangle',
          f: i % 2 ? 1600 : 2000,
          t: t + i,
          dur: 0.008,
          vol: vol * 0.05,
          release: 0.01,
        });
      }
      if (rand() < 0.7) {
        taps(v, dest, t + rand(), {
          count: 4 + Math.floor(rand() * 6),
          gap: [0.06, 0.16],
          f: 2200,
          q: 2,
          vol: vol * 0.1,
          rand,
        });
      }
    },
  },

  // Private sales: the shop door bell or the till.
  bag: {
    cadence: { min: 4, max: 8 },
    play(v, dest, t, vol, rand) {
      if (rand() < 0.5) {
        ding(v, dest, t, 88, vol * 0.05, 0.5);
        ding(v, dest, t + 0.12, 84, vol * 0.05, 0.6);
        return;
      }
      v.noise(dest, { t, dur: 0.07, vol: vol * 0.15, type: 'lowpass', f: 900 });
      v.tone(dest, { wave: v.waves.pulse25, f: hz(96), t: t + 0.08, dur: 0.06, vol: vol * 0.04, release: 0.3 });
      v.tone(dest, { wave: v.waves.pulse25, f: hz(100), t: t + 0.14, dur: 0.1, vol: vol * 0.04, release: 0.4 });
    },
  },

  // Luxury rentals: a jingle of keys or the door chime.
  house: {
    cadence: { min: 4, max: 8 },
    play(v, dest, t, vol, rand) {
      if (rand() < 0.5) {
        ding(v, dest, t, 76, vol * 0.06, 0.7);
        ding(v, dest, t + 0.45, 72, vol * 0.06, 0.9);
        return;
      }
      for (let i = 0, at = t; i < 7; i++, at += between(rand, 0.03, 0.08)) {
        v.tone(dest, {
          type: 'sine',
          f: between(rand, 3000, 6000),
          t: at,
          dur: 0.015,
          vol: vol * 0.025,
          release: 0.05,
        });
      }
    },
  },

  // Hotel: the reception bell, sometimes rung twice by an impatient guest.
  octagon: {
    cadence: { min: 4, max: 9 },
    play(v, dest, t, vol, rand) {
      ding(v, dest, t, 93, vol * 0.06, 1);
      if (rand() < 0.3) ding(v, dest, t + 0.25, 93, vol * 0.05, 1);
    },
  },

  // Crypto: coins clinking or a phone notification.
  coin: {
    cadence: { min: 3, max: 6 },
    play(v, dest, t, vol, rand) {
      if (rand() < 0.5) {
        v.tone(dest, { wave: v.waves.pulse25, f: hz(95), t, dur: 0.04, vol: vol * 0.035 });
        v.tone(dest, { wave: v.waves.pulse25, f: hz(100), t: t + 0.05, dur: 0.12, vol: vol * 0.035, release: 0.15 });
        return;
      }
      v.tone(dest, { type: 'sine', f: 1320, t, dur: 0.05, vol: vol * 0.05 });
      v.tone(dest, { type: 'sine', f: 1760, t: t + 0.08, dur: 0.07, vol: vol * 0.05 });
    },
  },

  // Hardware wallets: a PIN typed on a keypad, then the confirm tone.
  device: {
    cadence: { min: 4, max: 8 },
    play(v, dest, t, vol, rand) {
      const digits = 4 + Math.floor(rand() * 3);
      for (let i = 0; i < digits; i++) {
        const f = DTMF[Math.floor(rand() * DTMF.length)];
        v.tone(dest, { type: 'square', f, t: t + i * 0.16, dur: 0.05, vol: vol * 0.015 });
      }
      if (rand() < 0.6) {
        const at = t + digits * 0.16 + 0.1;
        v.tone(dest, { type: 'triangle', f: hz(79), t: at, dur: 0.08, vol: vol * 0.05 });
        v.tone(dest, { type: 'triangle', f: hz(84), t: at + 0.09, dur: 0.14, vol: vol * 0.05, release: 0.1 });
      }
    },
  },
};

export const NATURE = {
  // Quick pitch sweeps; pitch and direction vary per chirp.
  birds: {
    cadence: { min: 0.8, max: 3.5 },
    play({ tone }, dest, t, vol, rand) {
      const f = between(rand, 2600, 4200);
      const chirps = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < chirps; i++) {
        const from = f * between(rand, 0.9, 1.1);
        tone(dest, {
          type: 'sine',
          f: from,
          slideTo: from * between(rand, 0.7, 1.5),
          t: t + i * 0.13,
          dur: 0.07,
          vol: vol * 0.025,
        });
      }
    },
  },

  // Pulsed high tones, one cricket per one-shot at its own pitch.
  crickets: {
    cadence: { min: 0.5, max: 1.4 },
    play({ tone }, dest, t, vol, rand) {
      const f = between(rand, 4300, 4900);
      for (let i = 0; i < 4; i++)
        tone(dest, { type: 'sine', f, t: t + i * 0.045, dur: 0.018, vol: vol * 0.012, release: 0.01 });
    },
  },
} satisfies Record<string, Ambience>;
