import { hz } from './song.ts';
import type { Synth } from './synth.ts';

export interface StepPayload {
  surface: string;
  loudness: number;
}

export type SfxName = 'step' | 'jump' | 'land' | 'near' | 'open' | 'close' | 'teleport' | 'achievement' | ArcadeSfx;

type ArcadeSfx =
  | 'arcadeCoin'
  | 'arcadeStart'
  | 'arcadeShoot'
  | 'arcadeHit'
  | 'arcadeHurt'
  | 'arcadeMarch'
  | 'arcadeWave'
  | 'arcadeBonus'
  | 'arcadeOver';

const MARCH_NOTES = [41, 39, 37, 36]; // the formation's descending four-note bass

type SfxPlayer = (synth: Synth, t: number, payload: StepPayload) => void;

// Each effect: (synth, startTime, payload) => void. All go through the sfx bus.
export const SFX: Record<SfxName, SfxPlayer> = {
  step({ bus, tone, noise }, t, { surface, loudness }) {
    const f = (surface === 'road' ? 1000 : 1700) * (0.85 + Math.random() * 0.3);
    noise(bus.sfx, { t, dur: 0.04, vol: 0.14 * loudness, type: 'bandpass', f, q: 1.2 });
    // A faint, short body: a deep, long thud reads as clogs.
    tone(bus.sfx, { type: 'triangle', f: 180, slideTo: 110, t, dur: 0.025, vol: 0.035 * loudness });
  },

  jump({ bus, tone, waves }, t) {
    tone(bus.sfx, { wave: waves.pulse25, f: 260, slideTo: 640, t, dur: 0.12, vol: 0.07 });
  },

  land({ bus, tone, noise }, t) {
    noise(bus.sfx, { t, dur: 0.1, vol: 0.4, type: 'lowpass', f: 500 });
    tone(bus.sfx, { type: 'triangle', f: 100, slideTo: 45, t, dur: 0.08, vol: 0.25 });
  },

  near({ bus, tone, waves }, t) {
    tone(bus.sfx, { wave: waves.pulse25, f: hz(88), t, dur: 0.05, vol: 0.05 });
    tone(bus.sfx, { wave: waves.pulse25, f: hz(95), t: t + 0.06, dur: 0.07, vol: 0.05 });
  },

  open({ bus, tone, waves }, t) {
    [72, 76, 79, 84].forEach((m, i) =>
      tone(bus.sfx, { wave: waves.pulse25, f: hz(m), t: t + i * 0.05, dur: 0.07, vol: 0.07 }),
    );
  },

  close({ bus, tone, waves }, t) {
    [84, 79, 76].forEach((m, i) =>
      tone(bus.sfx, { wave: waves.pulse25, f: hz(m), t: t + i * 0.04, dur: 0.05, vol: 0.05 }),
    );
  },

  teleport({ bus, tone, noise }, t) {
    tone(bus.sfx, { type: 'square', f: 200, slideTo: 1600, t, dur: 0.25, vol: 0.04 });
    noise(bus.sfx, { t, dur: 0.3, vol: 0.15, f: 3000 });
  },

  achievement({ bus, tone, waves }, t) {
    [72, 76, 79, 84].forEach((m, i) => {
      tone(bus.sfx, { wave: waves.pulse25, f: hz(m), t: t + i * 0.09, dur: 0.08, vol: 0.08 });
      tone(bus.sfx, { type: 'triangle', f: hz(m - 12), t: t + i * 0.09, dur: 0.08, vol: 0.15 });
    });
    tone(bus.sfx, { wave: waves.pulse25, f: hz(88), t: t + 0.36, dur: 0.45, vol: 0.08 });
    tone(bus.sfx, { type: 'triangle', f: hz(76), t: t + 0.36, dur: 0.45, vol: 0.15 });
  },

  // Bug Invaders cabinet (ui/arcade.ts).
  arcadeCoin({ bus, tone, waves }, t) {
    tone(bus.sfx, { wave: waves.pulse50, f: hz(91), t, dur: 0.06, vol: 0.06 });
    tone(bus.sfx, { wave: waves.pulse50, f: hz(96), t: t + 0.07, dur: 0.22, vol: 0.06 });
  },

  arcadeStart({ bus, tone, waves }, t) {
    [60, 64, 67, 72, 76, 79].forEach((m, i) =>
      tone(bus.sfx, { wave: waves.pulse50, f: hz(m), t: t + i * 0.05, dur: 0.05, vol: 0.06 }),
    );
  },

  arcadeShoot({ bus, tone }, t) {
    tone(bus.sfx, { type: 'square', f: 1400, slideTo: 350, t, dur: 0.07, vol: 0.025 });
  },

  arcadeHit({ bus, tone, noise }, t) {
    noise(bus.sfx, { t, dur: 0.09, vol: 0.2, f: 2500 });
    tone(bus.sfx, { type: 'triangle', f: 500, slideTo: 90, t, dur: 0.07, vol: 0.12 });
  },

  arcadeHurt({ bus, tone, noise }, t) {
    noise(bus.sfx, { t, dur: 0.6, vol: 0.35, type: 'lowpass', f: 900 });
    tone(bus.sfx, { type: 'square', f: 320, slideTo: 40, t, dur: 0.55, vol: 0.05 });
  },

  // The payload is the beat index (GameEvent.ARCADE_MARCH), not a step.
  arcadeMarch({ bus, tone }, t, payload) {
    const m = MARCH_NOTES[Number(payload) % MARCH_NOTES.length];
    tone(bus.sfx, { type: 'triangle', f: hz(m), t, dur: 0.08, vol: 0.22 });
  },

  arcadeWave({ bus, tone, waves }, t) {
    [72, 76, 79, 84, 79, 84].forEach((m, i) =>
      tone(bus.sfx, { wave: waves.pulse25, f: hz(m), t: t + i * 0.08, dur: 0.07, vol: 0.07 }),
    );
  },

  arcadeBonus({ bus, tone, waves }, t) {
    tone(bus.sfx, { wave: waves.pulse25, f: 600, slideTo: 1800, t, dur: 0.18, vol: 0.05 });
    [84, 88, 91].forEach((m, i) =>
      tone(bus.sfx, { wave: waves.pulse50, f: hz(m), t: t + 0.18 + i * 0.05, dur: 0.05, vol: 0.05 }),
    );
  },

  arcadeOver({ bus, tone, waves }, t) {
    [67, 63, 60, 55].forEach((m, i) => {
      tone(bus.sfx, { wave: waves.pulse25, f: hz(m), t: t + i * 0.16, dur: 0.14, vol: 0.07 });
      tone(bus.sfx, { type: 'triangle', f: hz(m - 12), t: t + i * 0.16, dur: 0.14, vol: 0.14 });
    });
  },
};
