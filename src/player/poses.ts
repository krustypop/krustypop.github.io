import { PLAYER } from '../config.ts';

export type IdleClip = 'phone' | 'stretch' | null;

/** Joint targets the character damps toward. In each pair, A is the -X limb, B the +X one. */
export interface Pose {
  swing: [legA: number, legB: number, armA: number, armB: number]; // rotation.x, negative is forward
  spread: [armA: number, armB: number]; // rotation.z, arms away from the body
  headPitch: number; // positive looks down
  headYaw: number; // positive looks left (+X)
  hop: number; // body height above the feet, not the physics position
  phone: boolean;
  rate: number; // how fast joints blend to this pose
}

/** Timers kept by the character, in seconds. */
export interface PoseClock {
  still: number; // standing still on the ground, not seated
  look: number; // since stopping at the curb of a crosswalk
  dance: number; // since the celebration started
}

export const IDLE_DELAY = 6;
export const LOOK_DURATION = 1.2;
export const DANCE_DURATION = 4;

const SWING = 0.8; // max limb swing, radians
const BOB = 0.07;
const POSE_RATE = 18;
const IDLE_RATE = 5; // idle clips ease in lazily
const AIRBORNE_POSE: Pose['swing'] = [0.6, -0.4, -2.6, -2.6];
const SEATED_POSE: Pose['swing'] = [-1.45, -1.45, -0.45, -0.45]; // legs forward, hands on the knees
const LOOK_YAW = 0.9;
const DANCE_BEAT = Math.PI * 2; // one arm cycle per second, a hop every half
const DANCE_HOP = 0.22;

// Clips play in turn with pauses between them: [clip, seconds].
const IDLE_CYCLE: [IdleClip, number][] = [
  ['phone', 5],
  [null, 2.5],
  ['stretch', 2.5],
  [null, 4],
];
const IDLE_PERIOD = IDLE_CYCLE.reduce((sum, [, d]) => sum + d, 0);

export function idleClipAt(still: number): IdleClip {
  if (still < IDLE_DELAY) return null;
  let t = (still - IDLE_DELAY) % IDLE_PERIOD;
  for (const [clip, d] of IDLE_CYCLE) {
    if (t < d) return clip;
    t -= d;
  }
  return null;
}

// Left, right, left: one and a half sine periods, zero at both ends.
export function lookYawAt(t: number) {
  if (t < 0 || t >= LOOK_DURATION) return 0;
  return LOOK_YAW * Math.sin((3 * Math.PI * t) / LOOK_DURATION);
}

export const createPose = (): Pose => ({
  swing: [0, 0, 0, 0],
  spread: [0, 0],
  headPitch: 0,
  headYaw: 0,
  hop: 0,
  phone: false,
  rate: POSE_RATE,
});

function set(out: Pose, [legA, legB, armA, armB]: Pose['swing'], spread = 0) {
  out.swing[0] = legA;
  out.swing[1] = legB;
  out.swing[2] = armA;
  out.swing[3] = armB;
  out.spread[0] = out.spread[1] = spread;
}

function walk(out: Pose, phase: number, amount: number) {
  const swing = Math.sin(phase) * SWING * amount;
  out.swing[0] = out.swing[3] = swing;
  out.swing[1] = out.swing[2] = -swing;
  out.spread[0] = out.spread[1] = 0;
  out.hop = Math.abs(Math.sin(phase)) * BOB * amount;
}

// Arms pump in turn, the body hops on every beat; legs keep walking if the dancer moves.
function dance(out: Pose, t: number, moving: boolean) {
  const s = Math.sin(t * DANCE_BEAT);
  out.swing[2] = -1.4 - 1.3 * s;
  out.swing[3] = -1.4 + 1.3 * s;
  out.spread[0] = out.spread[1] = 0.3;
  if (!moving) {
    out.swing[0] = 0.3 * s;
    out.swing[1] = -0.3 * s;
  }
  out.hop = Math.max(out.hop, DANCE_HOP * Math.abs(Math.sin(t * DANCE_BEAT)));
  out.headPitch = 0.15 * Math.sin(t * DANCE_BEAT * 2);
}

/** Writes the pose for this frame into `out` (no allocation). Seated and airborne win over everything. */
export function heroPose(
  { speed, phase, grounded, seated }: { speed: number; phase: number; grounded: boolean; seated: boolean },
  { still, look, dance: danced }: PoseClock,
  out: Pose,
) {
  out.headPitch = 0;
  out.headYaw = lookYawAt(look);
  out.hop = 0;
  out.phone = false;
  out.rate = POSE_RATE;

  if (seated) set(out, SEATED_POSE);
  else if (!grounded) set(out, AIRBORNE_POSE);
  else {
    const amount = Math.min(1, Math.abs(speed) / PLAYER.walkSpeed);
    walk(out, phase, amount);
    if (danced < DANCE_DURATION) dance(out, danced, amount > 0.1);
    else if (still >= IDLE_DELAY) idle(out, idleClipAt(still));
  }
  return out;
}

function idle(out: Pose, clip: IdleClip) {
  out.rate = IDLE_RATE;
  if (!clip) return;
  if (clip === 'phone') {
    // One arm up in front of the chest, eyes on the screen.
    out.swing[3] = -1.35;
    out.spread[1] = -0.35;
    out.headPitch = 0.45;
    out.phone = true;
  } else {
    // Both arms over the head, face to the sky.
    out.swing[2] = out.swing[3] = -3;
    out.spread[0] = out.spread[1] = 0.25;
    out.headPitch = -0.3;
  }
}
