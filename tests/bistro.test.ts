import { describe, expect, test } from 'bun:test';
import { CHAIR_OFFSET, lotToWorld, TERRACE } from '../src/world/bistro.ts';
import { ROAD_HALF, WALK_HALF } from '../src/world/layout.ts';

// Street furniture on the lot's sidewalk (furniture.ts), relative to the bench: |x| from the road axis, dz along it.
const KEEP_CLEAR = [
  { x: 8.9, dz: -0.7, r: 0.6 }, // bench
  { x: 8.9, dz: 0.7, r: 0.6 },
  { x: 8.6, dz: -2.2, r: 1.13 }, // flower beds, 1.6 m squares
  { x: 8.6, dz: 2.2, r: 1.13 },
  { x: 8.6, dz: -4.5, r: 1.13 },
  { x: 6.7, dz: 4, r: 0.35 }, // curb lamp
  { x: 8.6, dz: 12.5, r: 0.7 }, // street tree trunk and soil
];
const BUILDING_Z = -56;

describe('bistro terrace', () => {
  for (const side of [-1, 1]) {
    const pieces = TERRACE.map((p) => ({ ...p, ...lotToWorld(side, BUILDING_Z, p.dz, p.d) }));

    test(`every piece stands on the sidewalk (side ${side})`, () => {
      for (const p of pieces) {
        expect(Math.sign(p.x)).toBe(side);
        expect(Math.abs(p.x) - p.r).toBeGreaterThan(ROAD_HALF);
        expect(Math.abs(p.x)).toBeLessThan(WALK_HALF);
      }
    });

    test(`keeps the bench, flower beds, lamp and tree clear (side ${side})`, () => {
      for (const p of pieces) {
        for (const o of KEEP_CLEAR) {
          const d = Math.hypot(p.x - side * o.x, p.z - (BUILDING_Z + o.dz));
          expect(d).toBeGreaterThanOrEqual(p.r + o.r);
        }
      }
    });
  }

  test('pieces do not overlap each other', () => {
    TERRACE.forEach((a, i) => {
      for (const b of TERRACE.slice(i + 1)) {
        expect(Math.hypot(a.dz - b.dz, a.d - b.d)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    });
  });

  test("a table's collider covers its chairs", () => {
    for (const t of TERRACE.filter((p) => p.kind === 'table')) expect(t.r).toBeGreaterThan(CHAIR_OFFSET + 0.22);
  });
});
