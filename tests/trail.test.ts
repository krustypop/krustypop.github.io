import { describe, expect, test } from 'bun:test';
import { BUILDING, createLayout, WALK_HALF } from '../src/world/layout.ts';
import { distanceToPath, hillHeight, PATH_HALF, parkGround, planTrail } from '../src/world/trail.ts';

describe('hiking trail', () => {
  const layout = createLayout(7);
  const plan = planTrail(layout);
  const { points, hill } = plan;

  test('starts at the sidewalk edge, facing a crosswalk', () => {
    expect(Math.abs(points[0].x)).toBeCloseTo(WALK_HALF);
    expect(layout.crosswalkZs).toContain(points[0].z);
  });

  test('never crosses into a building while between them', () => {
    for (const p of points) {
      if (Math.abs(p.x) > WALK_HALF + BUILDING.depth + PATH_HALF) continue;
      for (const z of layout.buildingZs) expect(Math.abs(p.z - z)).toBeGreaterThan(BUILDING.width / 2 + PATH_HALF);
    }
  });

  test('heads away from the avenue in small steps', () => {
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i].x)).toBeGreaterThanOrEqual(Math.abs(points[i - 1].x) - 1e-9);
      expect(Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)).toBeLessThan(0.6);
    }
  });

  test('winds rather than running straight', () => {
    const zs = points.map((p) => p.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(3);
  });

  test('climbs to the hilltop', () => {
    expect(hillHeight(hill, points.at(-1)!.x, points.at(-1)!.z)).toBe(hill.height);
    expect(hillHeight(hill, points[0].x, points[0].z)).toBe(0);
  });

  test('park trees keep off the path, stand on the hill, and are untouched elsewhere', () => {
    for (const p of points) expect(parkGround(plan, p.x, p.z)).toBeNull();
    const beside = { x: hill.x, z: hill.z + 4 };
    expect(distanceToPath(points, beside.x, beside.z)).toBeGreaterThan(3);
    expect(parkGround(plan, beside.x, beside.z)).toBeGreaterThan(0);
    expect(parkGround(plan, -plan.side * 20, plan.startZ)).toBe(0); // across the avenue
  });
});
