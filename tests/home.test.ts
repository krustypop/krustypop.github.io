import { describe, expect, test } from 'bun:test';
import { experiences, profile } from '../src/data.ts';
import { BUILDING, createLayout, homeSpot, WALK_HALF } from '../src/world/layout.ts';
import { onHomeLot } from '../src/world/home.ts';
import { planTrail } from '../src/world/trail.ts';

describe('family home', () => {
  const layout = createLayout(experiences.length);
  const starts = experiences.map((e) => Number(e.start));
  const spot = homeSpot(layout, starts, profile.family.firstChild)!;

  test('stands in the gap past the job held that year, on its side', () => {
    const i = starts.findLastIndex((s) => s <= profile.family.firstChild);
    expect(experiences[i].company).toBe('Klub');
    expect(spot.side).toBe(layout.sideOf(i));
    expect(spot.z).toBeLessThan(layout.buildingZs[i]);
    expect(spot.z).toBeGreaterThan(layout.buildingZs[i + 1]);
  });

  test('its lot keeps clear of the buildings on either side', () => {
    for (const z of layout.buildingZs) {
      const edge = z + Math.sign(spot.z - z) * (BUILDING.width / 2 + 0.1);
      expect(onHomeLot(spot, spot.side * (WALK_HALF + 5), edge)).toBe(false);
    }
  });

  test('never shares a gap with the hiking trail', () => {
    const trail = planTrail(layout);
    expect(spot.side === trail.side && spot.z === trail.startZ).toBe(false);
  });

  test('has no gap for a year before the first job', () => {
    expect(homeSpot(layout, starts, starts[0] - 1)).toBeNull();
  });
});
