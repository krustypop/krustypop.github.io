import { describe, expect, test } from 'bun:test';
import { createColliders } from '../src/world/collision.ts';
import { createLayout, crosswalkStripeXs, groundHeight, SIDEWALK_Y, WALK_HALF } from '../src/world/layout.ts';
import { nearestTarget } from '../src/world/targets.ts';

describe('layout', () => {
  const layout = createLayout(5);

  test('buildings alternate sides, starting on the left', () => {
    expect([0, 1, 2, 3].map(layout.sideOf)).toEqual([-1, 1, -1, 1]);
  });

  test('buildings run down the avenue, the plaza after the last one', () => {
    const zs = layout.buildingZs;
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeLessThan(zs[i - 1]);
    expect(layout.endZ).toBeLessThan(zs.at(-1)!);
    expect(layout.spawnZ).toBeGreaterThan(zs[0]);
  });

  test('progress goes from 0 at spawn to 1 at the plaza, clamped outside', () => {
    expect(layout.progressAt(layout.spawnZ)).toBe(0);
    expect(layout.progressAt(layout.endZ)).toBe(1);
    expect(layout.progressAt(layout.spawnZ + 50)).toBe(0);
    expect(layout.progressAt(layout.endZ - 50)).toBe(1);
  });

  test('the player is walled in between spawn and plaza', () => {
    expect(layout.walkBounds.maxZ).toBeGreaterThan(layout.spawnZ);
    expect(layout.walkBounds.minZ).toBeLessThan(layout.endZ);
  });

  test('center dashes never overlap the plaza or a crosswalk (same paint height: z-fighting)', () => {
    const plazaStart = layout.plaza.midZ + layout.plaza.depth / 2;
    for (const z of layout.dashZs) {
      expect(z - 1.3).toBeGreaterThan(plazaStart);
      for (const c of layout.crosswalkZs) expect(Math.abs(z - c)).toBeGreaterThanOrEqual(3);
    }
  });

  test('crosswalk stripes are symmetric across the road', () => {
    expect(crosswalkStripeXs).toHaveLength(7);
    crosswalkStripeXs.forEach((x, i) => expect(x + crosswalkStripeXs.at(-1 - i)!).toBeCloseTo(0));
  });

  test('each bench stands across the street and faces its building', () => {
    layout.benches.forEach((b, i) => {
      const side = layout.sideOf(i);
      expect(b.z).toBe(layout.buildingZs[i]);
      expect(Math.sign(b.x)).toBe(-side);
      expect(Math.sin(b.heading)).toBeCloseTo(side); // forward points at the facade
    });
  });

  test('a crosswalk covers its stripes on the road, not the sidewalk or the lane beside it', () => {
    const c = layout.crosswalkZs[0];
    expect(layout.onCrosswalk({ x: 0, z: c })).toBe(true);
    expect(layout.onCrosswalk({ x: -5.9, z: c + 1.5 })).toBe(true);
    expect(layout.onCrosswalk({ x: 0, z: c + 1.6 })).toBe(false);
    expect(layout.onCrosswalk({ x: 7, z: c })).toBe(false);
    expect(layout.onCrosswalk({ x: 0, z: layout.spawnZ })).toBe(false);
  });

  test("a crosswalk's foot is the strip of sidewalk at each end of its stripes", () => {
    const c = layout.crosswalkZs[0];
    expect(layout.crosswalkFoot({ x: -6.5, z: c })).toBe(-1);
    expect(layout.crosswalkFoot({ x: 7, z: c + 1.5 })).toBe(1);
    expect(layout.crosswalkFoot({ x: 0, z: c })).toBe(0); // on the stripes
    expect(layout.crosswalkFoot({ x: 9, z: c })).toBe(0); // by the facade
    expect(layout.crosswalkFoot({ x: 7, z: c + 2 })).toBe(0); // along the sidewalk
  });

  test('sidewalks are raised, the road is not', () => {
    expect(groundHeight(0)).toBe(0);
    expect(groundHeight(8)).toBe(SIDEWALK_Y);
    expect(groundHeight(-8)).toBe(SIDEWALK_Y);
  });
});

describe('collisions', () => {
  const bounds = { minZ: -100, maxZ: 10 };

  test('keeps the player between the facades and inside the avenue', () => {
    const colliders = createColliders(bounds);
    const pos = { x: 50, z: 50 };
    colliders.resolve(pos, 0.5);
    expect(pos).toEqual({ x: WALK_HALF - 0.5, z: 10 });
  });

  test('pushes the player out of a round obstacle', () => {
    const colliders = createColliders(bounds);
    colliders.add(0, 0, 1);
    const pos = { x: 0.2, z: 0 };
    colliders.resolve(pos, 0.5);
    expect(Math.hypot(pos.x, pos.z)).toBeCloseTo(1.5);
    expect(pos.x).toBeGreaterThan(0);
  });

  test('leaves a player clear of obstacles untouched', () => {
    const colliders = createColliders(bounds);
    colliders.add(0, 0, 1);
    const pos = { x: 3, z: -4 };
    colliders.resolve(pos, 0.5);
    expect(pos).toEqual({ x: 3, z: -4 });
  });
});

describe('rooms', () => {
  const bounds = { minZ: -100, maxZ: 10 };
  const room = { minX: WALK_HALF, maxX: WALK_HALF + 4, minZ: -20, maxZ: -17 };
  const withRoom = () => {
    const colliders = createColliders(bounds);
    colliders.addRoom(room);
    return colliders;
  };

  test('the player can walk through the opening to the back wall', () => {
    const colliders = withRoom();
    for (const x of [WALK_HALF - 0.3, WALK_HALF + 1, WALK_HALF + 3]) {
      const pos = { x, z: -18.5 };
      colliders.resolve(pos, 0.5);
      expect(pos).toEqual({ x, z: -18.5 });
    }
    const deep = { x: WALK_HALF + 9, z: -18.5 };
    colliders.resolve(deep, 0.5);
    expect(deep.x).toBe(room.maxX - 0.5);
  });

  test('side walls block inside the room', () => {
    const colliders = withRoom();
    const pos = { x: WALK_HALF + 2, z: -16.9 };
    colliders.resolve(pos, 0.5);
    expect(pos).toEqual({ x: WALK_HALF + 2, z: room.maxZ - 0.5 });
  });

  test('the facade still blocks beside the opening', () => {
    const colliders = withRoom();
    const pos = { x: WALK_HALF + 0.2, z: -10 };
    colliders.resolve(pos, 0.5);
    expect(pos).toEqual({ x: WALK_HALF - 0.5, z: -10 });
  });

  test('a room on the other side does not open this facade', () => {
    const colliders = withRoom();
    const pos = { x: -WALK_HALF - 1, z: -18.5 };
    colliders.resolve(pos, 0.5);
    expect(pos.x).toBe(-WALK_HALF + 0.5);
  });

  test('a mirrored room opens the left facade', () => {
    const colliders = createColliders(bounds);
    colliders.addRoom({ minX: -WALK_HALF - 4, maxX: -WALK_HALF, minZ: -20, maxZ: -17 });
    const pos = { x: -WALK_HALF - 2, z: -18.5 };
    colliders.resolve(pos, 0.5);
    expect(pos).toEqual({ x: -WALK_HALF - 2, z: -18.5 });
  });
});

describe('nearest target', () => {
  const targets = [
    { id: 'a', door: { x: -10, z: 0 } },
    { id: 'b', door: { x: 10, z: 0 } },
  ];

  test('picks the closest door within reach', () => {
    expect(nearestTarget(targets, { x: 8, z: 0 }, 3.4)?.id).toBe('b');
    expect(nearestTarget(targets, { x: -9, z: 1 }, 3.4)?.id).toBe('a');
  });

  test('returns null when every door is out of reach', () => {
    expect(nearestTarget(targets, { x: 0, z: 0 }, 3.4)).toBeNull();
  });
});
