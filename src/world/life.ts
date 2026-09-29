import type { XZ } from './types.ts';

// Rules for the street's passers-by, pigeons, cat and night windows: plain values in, decisions out.

// --- Pedestrians

export const PEDESTRIAN = {
  sitAwayFrom: 15, // takes a bench only while the player is farther
  leaveWithin: 5, // gets up as soon as the player comes this close
};

/** Walking direction along z after the avenue's ends: turns back past either bound. */
export function turnAround(z: number, dir: number, minZ: number, maxZ: number): -1 | 1 {
  if (dir < 0 && z <= minZ) return 1;
  if (dir > 0 && z >= maxZ) return -1;
  return dir < 0 ? -1 : 1;
}

/**
 * Writes to `out` a push away from `other`, from 0 at `space` to 1 when touching; returns its strength.
 * `tie` picks the sideways direction when both stand on the same spot, so two walkers split apart.
 */
export function personalSpace(self: XZ, other: XZ, space: number, out: XZ, tie = 1) {
  const dx = self.x - other.x;
  const dz = self.z - other.z;
  const d = Math.hypot(dx, dz);
  if (d >= space) {
    out.x = out.z = 0;
    return 0;
  }
  const k = 1 - d / space;
  if (d < 1e-4) {
    out.x = tie * k;
    out.z = 0;
  } else {
    out.x = (dx / d) * k;
    out.z = (dz / d) * k;
  }
  return k;
}

export const maySit = (playerToBench: number, free: boolean) => free && playerToBench > PEDESTRIAN.sitAwayFrom;

export const mustLeave = (playerToBench: number, timeLeft: number) =>
  timeLeft <= 0 || playerToBench < PEDESTRIAN.leaveWithin;

// --- Pigeons

export const PIGEON = { flee: 3, fleeRunning: 5, running: 8 };

export const fleeDistance = (playerSpeed: number) =>
  Math.abs(playerSpeed) > PIGEON.running ? PIGEON.fleeRunning : PIGEON.flee;

export const shouldFlee = (distance: number, playerSpeed: number) => distance < fleeDistance(playerSpeed);

/** Point `t` ∈ [0, 1] along a hop from `from` to `to` peaking `height` above the straight line. */
export function arcPoint(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  t: number,
  height: number,
  out: { x: number; y: number; z: number },
) {
  out.x = from.x + (to.x - from.x) * t;
  out.z = from.z + (to.z - from.z) * t;
  out.y = from.y + (to.y - from.y) * t + 4 * height * t * (1 - t);
  return out;
}

// --- Cat

export type CatMode = 'sleep' | 'wake' | 'follow' | 'return';

export interface CatBrain {
  mode: CatMode;
  timer: number;
  armed: boolean; // false until the player has walked away after the last nap began
}

export const CAT = { wake: 3, rearm: 7, stretch: 1.8, follow: 20, keep: 2 };

export const createCatBrain = (): CatBrain => ({ mode: 'sleep', timer: 0, armed: true });

/** Advances the cat's mood; `atHome` is true once it is back on its perch. */
export function stepCat(brain: CatBrain, dt: number, playerDist: number, atHome: boolean): CatMode {
  switch (brain.mode) {
    case 'sleep':
      if (!brain.armed && playerDist > CAT.rearm) brain.armed = true;
      if (brain.armed && playerDist < CAT.wake) {
        brain.mode = 'wake';
        brain.timer = CAT.stretch;
        brain.armed = false;
      }
      break;
    case 'wake':
      brain.timer -= dt;
      if (brain.timer <= 0) {
        brain.mode = 'follow';
        brain.timer = CAT.follow;
      }
      break;
    case 'follow':
      brain.timer -= dt;
      if (brain.timer <= 0) brain.mode = 'return';
      break;
    case 'return':
      if (atHome) brain.mode = 'sleep';
      break;
  }
  return brain.mode;
}

// --- Windows at night

const LIGHTS_OFF = { from: 22, span: 4 }; // 22h → 2h
const LIGHTS_ON = { from: 5, span: 1 }; // early risers, 5h → 6h
const NIGHT_OWLS = 0.1;

/** Hours at which one lit window goes dark and comes back, from two uniform draws in [0, 1). */
export function lightsSchedule(u: number, v: number) {
  const owl = u < NIGHT_OWLS;
  return {
    offAt: owl ? Infinity : LIGHTS_OFF.from + ((u - NIGHT_OWLS) / (1 - NIGHT_OWLS)) * LIGHTS_OFF.span,
    onAt: LIGHTS_ON.from + v * LIGHTS_ON.span,
  };
}

/** Whether a window scheduled by `lightsSchedule` is switched off at `hour` (0 ≤ hour < 24). */
export function lightsOut(hour: number, offAt: number, onAt: number) {
  // Count past-midnight hours as 24+, so the night is one increasing stretch.
  const h = hour < 12 ? hour + 24 : hour;
  return h >= offAt && h < onAt + 24;
}
