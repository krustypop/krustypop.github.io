import { expect, test } from 'bun:test';
import { NATURE, PLACE_AMBIENCE, type Voices } from '../src/audio/ambient-sfx.ts';
import {
  type Cadence,
  LOOKAHEAD,
  natureMix,
  nextDue,
  PLACE_FAR,
  PLACE_NEAR,
  placeGain,
  takeDue,
  TICK_MS,
  type Voice,
} from '../src/audio/ambience.ts';
import { rng } from '../src/utils/random.ts';

const TICK = TICK_MS / 1000;

// Replays the scheduler's timer: returns the start times it would play.
function simulate(cadence: Cadence, seconds: number, audibleAt: (now: number) => boolean, rand = rng(1)) {
  const voice: Voice = { due: nextDue(0, cadence, rand) };
  const played: { t: number; now: number }[] = [];
  for (let now = 0; now < seconds; now += TICK) {
    const t = takeDue(voice, now, audibleAt(now), cadence, rand);
    if (t >= 0) played.push({ t, now });
  }
  return played;
}

test('a place is full at the door, silent past its reach, and fades in between', () => {
  expect(placeGain(0)).toBe(1);
  expect(placeGain(PLACE_NEAR)).toBe(1);
  expect(placeGain(PLACE_FAR)).toBe(0);
  expect(placeGain(40)).toBe(0);
  let last = 1;
  for (let d = PLACE_NEAR; d <= PLACE_FAR; d += 0.5) {
    expect(placeGain(d)).toBeLessThanOrEqual(last);
    last = placeGain(d);
  }
});

test('walking the middle of the avenue past a door is only a faint hint', () => {
  // Doors sit at |x| = 10 from the avenue axis.
  expect(placeGain(10)).toBeGreaterThan(0);
  expect(placeGain(10)).toBeLessThan(0.3);
});

test('two neighbouring buildings, 34 m apart, are never heard together', () => {
  for (let z = 0; z <= 34; z += 0.5) expect(placeGain(z) > 0 && placeGain(34 - z) > 0).toBe(false);
});

test('birds by day, crickets by night, no loudness dip at dusk', () => {
  expect(natureMix(0)).toEqual({ birds: 1, crickets: 0 });
  const night = natureMix(1);
  expect(night.birds).toBeCloseTo(0);
  expect(night.crickets).toBe(1);
  for (const n of [0.25, 0.5, 0.75]) {
    const { birds, crickets } = natureMix(n);
    expect(birds ** 2 + crickets ** 2).toBeCloseTo(1);
  }
});

test.each(Object.entries({ ...PLACE_AMBIENCE, ...NATURE }))('%s plays about once per cadence', (_, { cadence }) => {
  const minutes = 5;
  const played = simulate(cadence, minutes * 60, () => true);
  expect(played.length).toBeGreaterThanOrEqual(Math.floor((minutes * 60) / cadence.max) - 1);
  expect(played.length).toBeLessThanOrEqual(Math.ceil((minutes * 60) / cadence.min));
});

test('one-shots are queued ahead, never in the past', () => {
  for (const { t, now } of simulate({ min: 0.5, max: 1.4 }, 60, () => true)) {
    expect(t).toBeGreaterThanOrEqual(now);
    expect(t).toBeLessThanOrEqual(now + LOOKAHEAD);
  }
});

test('nothing plays out of earshot, and arriving is heard within one cadence', () => {
  const cadence = { min: 4, max: 8 };
  expect(simulate(cadence, 60, () => false)).toHaveLength(0);
  const arrival = 30;
  const [first] = simulate(cadence, 60, (now) => now >= arrival);
  expect(first.t - arrival).toBeLessThanOrEqual(cadence.max + TICK);
});

test('a stalled clock restarts the rhythm instead of firing a late burst', () => {
  const cadence = { min: 1, max: 2 };
  const rand = rng(3);
  const voice: Voice = { due: 1 };
  expect(takeDue(voice, 40, true, cadence, rand)).toBe(-1);
  expect(voice.due).toBeGreaterThanOrEqual(40 + cadence.min);
});

// Records the voices a recipe schedules.
function recorder() {
  const calls: { t: number; vol: number }[] = [];
  const voices: Voices = {
    tone: (_dest, { t, vol }) => void calls.push({ t, vol }),
    noise: (_dest, { t, vol }) => void calls.push({ t, vol }),
    waves: { pulse25: {} as PeriodicWave, pulse50: {} as PeriodicWave },
  };
  return { calls, voices };
}

test.each(Object.entries({ ...PLACE_AMBIENCE, ...NATURE }))(
  '%s is a short, soft one-shot at its start time',
  (_, { play }) => {
    for (let seed = 0; seed < 20; seed++) {
      const { calls, voices } = recorder();
      play(voices, {} as AudioNode, 10, 1, rng(seed));
      expect(calls.length).toBeGreaterThan(0);
      for (const { t, vol } of calls) {
        expect(t).toBeGreaterThanOrEqual(10);
        expect(t).toBeLessThan(10 + 5);
        expect(vol).toBeGreaterThan(0);
        expect(vol).toBeLessThanOrEqual(0.2);
      }
    }
  },
);

test('a recipe scales with its gain', () => {
  const full = recorder();
  const half = recorder();
  PLACE_AMBIENCE.octagon.play(full.voices, {} as AudioNode, 0, 1, rng(5));
  PLACE_AMBIENCE.octagon.play(half.voices, {} as AudioNode, 0, 0.5, rng(5));
  half.calls.forEach(({ vol }, i) => expect(vol).toBeCloseTo(full.calls[i].vol / 2));
});
