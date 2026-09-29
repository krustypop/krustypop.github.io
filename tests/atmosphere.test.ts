import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { celestialDirections, createDayClock, wrapHour } from '../src/atmosphere/clock.ts';
import { createPalette, KEYS, samplePalette } from '../src/atmosphere/palette.ts';

describe('palette', () => {
  test('keyframes cover a full day in increasing order', () => {
    const hours = KEYS.map((k) => k.h);
    expect(hours[0]).toBe(0);
    expect(hours.at(-1)).toBe(24);
    for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThan(hours[i - 1]);
  });

  test('values stay in range', () => {
    for (const k of KEYS) {
      expect(k.night).toBeWithin(0, 1.0001);
      expect(k.density).toBeGreaterThan(0);
      expect(k.haze).toBeGreaterThan(0);
      expect(k.hemi).toBeGreaterThan(0);
    }
  });

  test('sampling on a keyframe returns that keyframe', () => {
    const p = samplePalette(12.5, createPalette());
    expect(p.night).toBe(0);
    expect(p.hemi).toBe(1.7);
    expect(p.horizon.equals(new THREE.Color('#d4e9f7'))).toBe(true);
  });

  test('deep night is fully night, noon is fully day', () => {
    expect(samplePalette(0, createPalette()).night).toBe(1);
    expect(samplePalette(13, createPalette()).night).toBe(0);
  });
});

describe('day clock', () => {
  test('a full day lasts 8 minutes', () => {
    const clock = createDayClock(10);
    clock.tick(20);
    expect(clock.hour).toBeCloseTo(11);
  });

  test('wraps hours into [0, 24)', () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(createDayClock(24).hour).toBe(0);
  });

  test('skipping warps to the next phase, then resumes normal time', () => {
    const clock = createDayClock(8);
    clock.skipToNextPhase();
    for (let i = 0; i < 10; i++) clock.tick(0.05); // 4 h at 8 h/s
    expect(clock.hour).toBe(12);
    clock.tick(20);
    expect(clock.hour).toBeCloseTo(13);
  });

  test('skipping late at night wraps past midnight to dawn', () => {
    const clock = createDayClock(23);
    clock.skipToNextPhase();
    for (let i = 0; i < 200; i++) clock.tick(0.05);
    expect(clock.hour).toBeGreaterThan(6.3);
    expect(clock.hour).toBeLessThan(7);
  });

  test('the sun is up at noon and down at midnight, the moon opposite', () => {
    const sun = new THREE.Vector3();
    const moon = new THREE.Vector3();
    celestialDirections(12.25, sun, moon);
    expect(sun.y).toBeGreaterThan(0.8);
    expect(moon.y).toBeLessThan(-0.8);
    celestialDirections(0.25, sun, moon);
    expect(sun.y).toBeLessThan(-0.8);
    expect(moon.y).toBeGreaterThan(0.8);
  });
});
