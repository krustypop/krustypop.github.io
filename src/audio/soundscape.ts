import { type Ambience, NATURE, PLACE_AMBIENCE } from './ambient-sfx.ts';
import { MIN_GAIN, natureMix, nextDue, type Place, placeGain, takeDue, TICK_MS, type Voice } from './ambience.ts';
import type { Synth } from './synth.ts';

/** What the soundscape reads on each tick; `createAudio` keeps it current. */
export interface Surroundings {
  places: readonly Place[];
  listener: { x: number; z: number };
  night: number;
  muted: boolean;
}

// Sparse one-shots queued ahead on the audio clock, like the sequencer: a suspended context freezes them too.
export function startSoundscape(synth: Synth, around: Surroundings): void {
  const { ctx, bus } = synth;
  const rand = Math.random;
  const voices = new Map<object, Voice>(); // one rhythm per place, and per nature layer

  const run = (key: object, ambience: Ambience, gain: number, now: number) => {
    let voice = voices.get(key);
    if (!voice) voices.set(key, (voice = { due: nextDue(now, ambience.cadence, rand) }));
    const t = takeDue(voice, now, !around.muted && gain >= MIN_GAIN, ambience.cadence, rand);
    if (t >= 0) ambience.play(synth, bus.ambience, t, gain, rand);
  };

  setInterval(() => {
    const now = ctx.currentTime;
    const { x, z } = around.listener;
    for (const place of around.places) {
      run(place, PLACE_AMBIENCE[place.emblem], placeGain(Math.hypot(place.x - x, place.z - z)), now);
    }
    const mix = natureMix(around.night);
    run(NATURE.birds, NATURE.birds, mix.birds, now);
    run(NATURE.crickets, NATURE.crickets, mix.crickets, now);
  }, TICK_MS);
}
