import {
  ARP_PATTERN,
  BASS_PATTERN,
  compileHarmony,
  compileLead,
  FILL_BAR,
  hz,
  KICKS,
  MELODY,
  PROGRESSION,
  SNARES,
  STEP,
  STEPS_PER_BAR,
} from './song.ts';
import type { Synth } from './synth.ts';

const LOOKAHEAD = 0.15; // seconds of notes queued ahead of the audio clock
const TICK_MS = 25;
const START_DELAY = 0.1;
const SONG_STEPS = PROGRESSION.length * STEPS_PER_BAR;
const lead = compileLead(MELODY);
const harmony = compileHarmony(PROGRESSION);

// A coarse JS timer queues notes on the sample-accurate audio clock ("a tale of two clocks").
export function startSequencer({ ctx, bus, waves, tone, noise }: Synth): void {
  let step = 0;
  let nextTime = ctx.currentTime + START_DELAY;

  function playStep(i: number, t: number) {
    const bar = Math.floor(i / STEPS_PER_BAR);
    const s = i % STEPS_PER_BAR;
    const { bass, tones } = harmony[bar];

    const note = lead.get(i);
    if (note) tone(bus.lead, { wave: waves.pulse25, f: hz(note.midi), t, dur: note.length * STEP * 0.9, vol: 0.1 });
    if (s % 2 === 0) {
      tone(bus.bass, { type: 'triangle', f: hz(bass + BASS_PATTERN[s / 2]), t, dur: STEP * 1.6, vol: 0.24 });
    }
    tone(bus.arp, { wave: waves.pulse50, f: hz(tones[ARP_PATTERN[s % 4]]), t, dur: STEP * 0.5, vol: 0.03 });

    if (KICKS.has(s)) tone(bus.drums, { type: 'triangle', f: 160, slideTo: 45, t, dur: 0.12, vol: 0.5 });
    if (SNARES.has(s) || (bar % 8 === FILL_BAR && s >= 13)) noise(bus.drums, { t, dur: 0.12, vol: 0.22, f: 1800 });
    if (s % 2 === 0) noise(bus.drums, { t, dur: 0.03, vol: s % 4 === 2 ? 0.07 : 0.035, f: 7000 });
  }

  setInterval(() => {
    // After a stall (suspended tab), resync instead of firing a burst of late notes.
    if (nextTime < ctx.currentTime - 0.05) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      playStep(step, nextTime);
      step = (step + 1) % SONG_STEPS;
      nextTime += STEP;
    }
  }, TICK_MS);
}
