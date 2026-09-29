import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { createCat } from '../src/world/cat.ts';
import { createColliders } from '../src/world/collision.ts';
import { createLayout, SIDEWALK_Y, WALK_HALF } from '../src/world/layout.ts';
import {
  arcPoint,
  CAT,
  createCatBrain,
  fleeDistance,
  lightsOut,
  lightsSchedule,
  maySit,
  mustLeave,
  personalSpace,
  shouldFlee,
  stepCat,
  turnAround,
} from '../src/world/life.ts';
import { createPedestrians } from '../src/world/pedestrians.ts';
import { createPigeons } from '../src/world/pigeons.ts';
import { rng } from '../src/utils/random.ts';

const layout = createLayout(7);
const benches = layout.benches.map(({ x, z, heading }) => ({ seat: { x, z }, seatY: SIDEWALK_Y + 0.55, heading }));
const far = { x: 0, z: 1000 };

function run(frames: number, step: (dt: number, t: number) => void, dt = 1 / 30) {
  for (let f = 0; f < frames; f++) step(dt, f * dt);
}

describe('pedestrians', () => {
  test('turn back at either end of the avenue, keep going in between', () => {
    expect(turnAround(-300, -1, -250, 18)).toBe(1);
    expect(turnAround(20, 1, -250, 18)).toBe(-1);
    expect(turnAround(0, -1, -250, 18)).toBe(-1);
    expect(turnAround(0, 1, -250, 18)).toBe(1);
  });

  test('step away from the player, harder the closer they are, and ignore them past personal space', () => {
    const out = { x: 0, z: 0 };
    expect(personalSpace({ x: 7.5, z: 0 }, { x: 7.5, z: 5 }, 2, out)).toBe(0);
    const near = personalSpace({ x: 8, z: 0 }, { x: 7.5, z: 0 }, 2, out);
    expect(out.x).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(personalSpace({ x: 9, z: 0 }, { x: 7.5, z: 0 }, 2, out));
    personalSpace({ x: 1, z: 1 }, { x: 1, z: 1 }, 2, out);
    expect(Number.isFinite(out.x) && Number.isFinite(out.z)).toBe(true);
  });

  test('only take a free bench while the player is far, and leave as soon as they come close', () => {
    expect(maySit(20, true)).toBe(true);
    expect(maySit(20, false)).toBe(false);
    expect(maySit(10, true)).toBe(false);
    expect(mustLeave(4, 10)).toBe(true);
    expect(mustLeave(10, 10)).toBe(false);
    expect(mustLeave(10, 0)).toBe(true);
  });

  test('stay on the sidewalks, clear of every obstacle, over a long stroll', () => {
    const colliders = createColliders(layout.walkBounds);
    colliders.add(7.5, -40, 0.6); // a prop right on the lane
    const people = createPedestrians(new THREE.Scene(), {
      colliders,
      benches,
      minZ: layout.endZ + 3,
      maxZ: layout.spawnZ + 2.5,
    });
    const start = people.walkers.map((w) => w.pos.z);
    run(3000, (dt) => people.update(dt, far));
    for (const w of people.walkers) {
      expect(Math.abs(w.pos.x)).toBeLessThanOrEqual(WALK_HALF);
      expect(w.pos.z).toBeGreaterThan(layout.endZ - 1);
      expect(w.pos.z).toBeLessThan(layout.spawnZ + 4);
      if (w.mode === 'walk') expect(Math.hypot(w.pos.x - 7.5, w.pos.z + 40)).toBeGreaterThan(0.85);
    }
    // Everyone went somewhere, nobody is stuck against the prop.
    people.walkers.forEach((w, i) =>
      expect(Math.abs(w.pos.z - start[i]) + (w.mode === 'sit' ? 99 : 0)).toBeGreaterThan(1),
    );
  });

  test('a sitter gets up and walks off when the player comes by', () => {
    const people = createPedestrians(new THREE.Scene(), {
      colliders: createColliders(layout.walkBounds),
      benches,
      minZ: layout.endZ + 3,
      maxZ: layout.spawnZ + 2.5,
    });
    let sitter = -1;
    for (let f = 0; f < 30 * 600 && sitter < 0; f++) {
      people.update(1 / 30, far);
      sitter = people.walkers.findIndex((w) => w.mode === 'sit');
    }
    expect(sitter).toBeGreaterThanOrEqual(0);
    const w = people.walkers[sitter];
    const player = { x: w.pos.x - Math.sign(w.pos.x) * 3, z: w.pos.z };
    run(60, (dt) => people.update(dt, player));
    expect(w.mode).not.toBe('sit');
    expect(w.bench).toBe(-1);
  });
});

describe('pigeons', () => {
  test('flee within 3 m, sooner when the player runs', () => {
    expect(shouldFlee(2.5, 6.5)).toBe(true);
    expect(shouldFlee(4, 6.5)).toBe(false);
    expect(shouldFlee(4, 11)).toBe(true);
    expect(fleeDistance(-11)).toBe(fleeDistance(11));
  });

  test('fly in an arc that starts and ends on the ground', () => {
    const from = { x: 0, y: 0.12, z: 0 };
    const to = { x: 10, y: 0.12, z: -20 };
    const out = { x: 0, y: 0, z: 0 };
    expect(arcPoint(from, to, 0, 5, out)).toEqual(from);
    expect(arcPoint(from, to, 1, 5, out)).toEqual(to);
    expect(arcPoint(from, to, 0.5, 5, out).y).toBeCloseTo(5.12);
  });

  test('a flock scatters when the player walks up, and lands again elsewhere', () => {
    const pigeons = createPigeons(new THREE.Scene(), { colliders: createColliders(layout.walkBounds), layout });
    const flock = pigeons.flocks[0];
    const bird = flock.members[0];
    const before = { x: bird.pos.x, z: bird.pos.z };
    pigeons.update(1 / 30, 0, before, 6.5, []);
    expect(flock.flying).toBe(true);
    run(30 * 10, (dt, t) => pigeons.update(dt, t, before, 0, []));
    expect(flock.flying).toBe(false);
    expect(Math.hypot(bird.pos.x - before.x, bird.pos.z - before.z)).toBeGreaterThan(5);
    expect(bird.pos.y).toBeLessThan(0.2);
  });
});

describe('cat', () => {
  test('wakes when the player comes close, stretches, follows for a while, then goes home to sleep', () => {
    const brain = createCatBrain();
    expect(stepCat(brain, 0.1, 10, true)).toBe('sleep');
    expect(stepCat(brain, 0.1, 2, true)).toBe('wake');
    expect(stepCat(brain, CAT.stretch, 2, false)).toBe('follow');
    expect(stepCat(brain, CAT.follow - 1, 2, false)).toBe('follow');
    expect(stepCat(brain, 1, 2, false)).toBe('return');
    expect(stepCat(brain, 0.1, 2, false)).toBe('return');
    expect(stepCat(brain, 0.1, 2, true)).toBe('sleep');
    // Back home with the player still around: it naps on until they have left once.
    expect(stepCat(brain, 0.1, 2, true)).toBe('sleep');
    stepCat(brain, 0.1, CAT.rearm + 1, true);
    expect(stepCat(brain, 0.1, 2, true)).toBe('wake');
  });

  test('keeps its distance while following, and ends up back on its ledge', () => {
    const home = { x: WALK_HALF, z: -18 };
    const cat = createCat(new THREE.Scene(), {
      colliders: createColliders(layout.walkBounds),
      home,
      facade: WALK_HALF,
    });
    const sleeping = cat.pos.clone();
    const player = { x: 8, z: -18 };
    run(30 * 6, (dt, t) => {
      player.z -= dt * 1.5;
      cat.update(dt, t, player);
    });
    expect(cat.brain.mode).toBe('follow');
    const gap = Math.hypot(cat.pos.x - player.x, cat.pos.z - player.z);
    expect(gap).toBeGreaterThan(CAT.keep - 0.6);
    expect(gap).toBeLessThan(CAT.keep + 1);
    run(30 * 90, (dt, t) => cat.update(dt, t, { x: 0, z: -200 }));
    expect(cat.brain.mode).toBe('sleep');
    expect(cat.pos.distanceTo(sleeping)).toBeLessThan(0.1);
  });
});

describe('windows at night', () => {
  const schedules = Array.from({ length: 500 }, (_, i) => {
    const r = rng(i + 1);
    return lightsSchedule(r(), r());
  });
  const litAt = (hour: number) => schedules.filter((s) => !lightsOut(hour, s.offAt, s.onAt)).length;

  test('every lit window is still on in the evening and on again by morning', () => {
    expect(litAt(21.9)).toBe(500);
    expect(litAt(6.01)).toBe(500);
    expect(litAt(12)).toBe(500);
  });

  test('lights go out one by one between 22h and 2h, a few night owls aside', () => {
    const counts = [22.5, 23.5, 0.5, 1.5, 3].map(litAt);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1]);
    expect(counts.at(-1)).toBeGreaterThan(0);
    expect(counts.at(-1)).toBeLessThan(100);
  });

  test('a window keeps its own habits', () => {
    const [a, b] = [lightsSchedule(0.5, 0.5), lightsSchedule(0.5, 0.5)];
    expect(a).toEqual(b);
    expect(a.offAt).toBeGreaterThanOrEqual(22);
    expect(a.offAt).toBeLessThan(26);
  });
});
