import type { Emblem } from '../data.ts';
import { clamp } from '../utils/math.ts';

/** A building heard near its door. */
export interface Place {
  emblem: Emblem;
  x: number;
  z: number;
}

/** Seconds between two one-shots of the same ambience. */
export interface Cadence {
  min: number;
  max: number;
}

export interface Voice {
  due: number; // audio-clock time of the next one-shot
}

export const PLACE_FAR = 15; // silent beyond, so neighbours 34 m apart never overlap
export const PLACE_NEAR = 4;
export const MIN_GAIN = 0.02;
export const LOOKAHEAD = 0.25; // must exceed the scheduler tick
export const TICK_MS = 100;

// Squared falloff: a faint hint from the road, clearly present only at the door.
export function placeGain(distance: number): number {
  const t = clamp((PLACE_FAR - distance) / (PLACE_FAR - PLACE_NEAR), 0, 1);
  return t * t;
}

// Equal-power crossfade, so dusk isn't a dip in loudness.
export function natureMix(night: number): { birds: number; crickets: number } {
  const a = (clamp(night, 0, 1) * Math.PI) / 2;
  return { birds: Math.cos(a), crickets: Math.sin(a) };
}

export const nextDue = (from: number, { min, max }: Cadence, rand: () => number) => from + min + rand() * (max - min);

/**
 * Consumes the voice's one-shot if it falls in the look-ahead window and returns its start time,
 * or -1. Inaudible voices keep their rhythm silently, so walking up to a door is heard soon.
 */
export function takeDue(voice: Voice, now: number, audible: boolean, cadence: Cadence, rand: () => number): number {
  if (voice.due > now + LOOKAHEAD) return -1;
  // After a stall, restart the rhythm instead of firing a late one-shot.
  if (voice.due < now) {
    voice.due = nextDue(now, cadence, rand);
    return -1;
  }
  const t = voice.due;
  voice.due = nextDue(t, cadence, rand);
  return audible ? t : -1;
}
