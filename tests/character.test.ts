import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { createEmitter, GameEvent } from '../src/core/events.ts';
import { createPlayer } from '../src/player/controller.ts';
import {
  createPose,
  DANCE_DURATION,
  heroPose,
  IDLE_DELAY,
  idleClipAt,
  LOOK_DURATION,
  lookYawAt,
} from '../src/player/poses.ts';

const standing = { speed: 0, phase: 0, grounded: true, seated: false };
const calm = { still: 0, look: LOOK_DURATION, dance: DANCE_DURATION };

// Widest head turn over [a, b), signed.
function peak(a: number, b: number) {
  let best = 0;
  for (let t = a; t < b; t += 0.01) if (Math.abs(lookYawAt(t)) > Math.abs(best)) best = lookYawAt(t);
  return best;
}

describe('idle clips', () => {
  test('nothing plays before the hero has stood still a while', () => {
    expect(idleClipAt(0)).toBeNull();
    expect(idleClipAt(IDLE_DELAY - 0.01)).toBeNull();
  });

  test('phone first, then a stretch, then it loops', () => {
    const seen: string[] = [];
    for (let t = IDLE_DELAY; t < IDLE_DELAY + 60; t += 0.1) {
      const clip = idleClipAt(t);
      if (clip && clip !== seen.at(-1)) seen.push(clip);
    }
    expect(seen.slice(0, 4)).toEqual(['phone', 'stretch', 'phone', 'stretch']);
  });

  test('the phone only shows while looking at it, and moving puts it away', () => {
    const pose = createPose();
    heroPose(standing, { ...calm, still: IDLE_DELAY + 1 }, pose);
    expect(pose.phone).toBe(true);
    expect(pose.headPitch).toBeGreaterThan(0);
    heroPose({ ...standing, speed: 3 }, { ...calm, still: 0 }, pose);
    expect(pose.phone).toBe(false);
    expect(pose.headPitch).toBe(0);
  });
});

describe('looking both ways', () => {
  test('left, right, left, then straight ahead', () => {
    const third = LOOK_DURATION / 3;
    expect(peak(0, third)).toBeGreaterThan(0.5);
    expect(peak(third, 2 * third)).toBeLessThan(-0.5);
    expect(peak(2 * third, LOOK_DURATION)).toBeGreaterThan(0.5);
    expect(lookYawAt(LOOK_DURATION)).toBe(0);
    expect(lookYawAt(10)).toBe(0);
  });

  test('works while walking', () => {
    const pose = heroPose({ ...standing, speed: 6, phase: 1 }, { ...calm, look: LOOK_DURATION / 6 }, createPose());
    expect(pose.headYaw).toBeCloseTo(lookYawAt(LOOK_DURATION / 6));
    expect(pose.swing[0]).not.toBe(0);
  });
});

describe('celebration', () => {
  test('arms pump in turn and the body hops, for a few seconds only', () => {
    const pose = createPose();
    const arms = new Set<number>();
    let hop = 0;
    for (let t = 0; t < DANCE_DURATION; t += 0.05) {
      heroPose(standing, { ...calm, dance: t }, pose);
      arms.add(Math.sign(pose.swing[2] - pose.swing[3]));
      hop = Math.max(hop, pose.hop);
    }
    expect(arms.has(1) && arms.has(-1)).toBe(true);
    expect(hop).toBeGreaterThan(0.1);
    heroPose(standing, { ...calm, dance: DANCE_DURATION }, pose);
    expect(pose.hop).toBe(0);
  });

  test('sitting and jumping keep their own poses', () => {
    const dancing = { ...calm, dance: 1, still: IDLE_DELAY + 1 };
    const seated = heroPose({ ...standing, seated: true }, dancing, createPose());
    expect(seated.swing[0]).toBeLessThan(-1); // legs forward
    expect(seated.hop).toBe(0);
    const airborne = heroPose({ ...standing, grounded: false }, dancing, createPose());
    expect(airborne.swing[2]).toBeLessThan(-2); // arms up
    expect(airborne.phone).toBe(false);
  });
});

// A crosswalk at z = 0: stripes for |x| < 6, its feet on the sidewalks up to |x| = 7.5.
const crosswalkWorld = (spawn: THREE.Vector3, spawnHeading: number) => ({
  spawn,
  spawnHeading,
  resolve: () => {},
  groundHeight: () => 0,
  nearestTarget: () => null,
  nearestBench: () => null,
  onCrosswalk: ({ x, z }: THREE.Vector3) => Math.abs(x) < 6 && Math.abs(z) <= 1.5,
  crosswalkFoot: ({ x, z }: THREE.Vector3) =>
    Math.abs(x) >= 6 && Math.abs(x) <= 7.5 && Math.abs(z) <= 1.5 ? (Math.sign(x) as -1 | 1) : 0,
});

describe('crosswalk', () => {
  const walk = { forward: 1, turn: 0, run: false, jump: false };

  function walkFrom(x: number, z: number, heading: number, seconds: number) {
    const events = createEmitter();
    const heard: string[] = [];
    events.on(GameEvent.CURB, () => heard.push('curb'));
    events.on(GameEvent.CROSS, () => heard.push('cross'));
    const player = createPlayer(crosswalkWorld(new THREE.Vector3(x, 0, z), heading), events);
    for (let t = 0; t < seconds; t += 0.05) player.update(0.05, walk);
    return { player, heard };
  }

  test('crossing curb to curb on the stripes looks once, then quotes', () => {
    const { player, heard } = walkFrom(-9, 0, Math.PI / 2, 5); // toward +X
    expect(player.state.pos.x).toBeGreaterThan(7.5);
    expect(heard).toEqual(['curb', 'cross']);
  });

  test('walking along the sidewalk past a crosswalk neither looks nor quotes', () => {
    const { heard } = walkFrom(-7, 6, Math.PI, 5); // toward -Z
    expect(heard).toEqual([]);
  });

  test('stepping onto the stripes from the road does not look', () => {
    const { heard } = walkFrom(0, 6, Math.PI, 3);
    expect(heard).toEqual([]);
  });

  test('crossing off the stripes gets no quote', () => {
    const { player, heard } = walkFrom(-7, 0, Math.PI / 4, 5); // diagonally, out of the stripes
    expect(player.state.pos.x).toBeGreaterThan(7.5);
    expect(heard).toEqual(['curb']);
  });
});
