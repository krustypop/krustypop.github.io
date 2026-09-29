import { describe, expect, test } from 'bun:test';
import { createEmitter } from '../src/core/events.ts';
import { clamp, damp, smoothstep } from '../src/utils/math.ts';
import { rng } from '../src/utils/random.ts';
import { readFlag, readNumber, writeFlag, writeNumber } from '../src/utils/storage.ts';

describe('events', () => {
  test('delivers payloads to every listener of a type', () => {
    const events = createEmitter<Record<string, unknown>>();
    const got: unknown[] = [];
    events.on('x', (p: unknown) => got.push(['a', p]));
    events.on('x', (p: unknown) => got.push(['b', p]));
    events.on('y', () => got.push(['wrong']));
    events.emit('x', 1);
    expect(got).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  test('stops delivering after unsubscribing', () => {
    const events = createEmitter<Record<string, void>>();
    let calls = 0;
    const off = events.on('x', () => calls++);
    events.emit('x');
    off();
    events.emit('x');
    expect(calls).toBe(1);
  });

  test('emitting with no listener is a no-op', () => {
    expect(() => createEmitter<Record<string, void>>().emit('nobody')).not.toThrow();
  });
});

describe('math', () => {
  test('clamp', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  test('smoothstep eases from 0 to 1 across the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  test('damp is frame-rate independent', () => {
    const once = damp(4, 0.1);
    const twiceHalf = 1 - (1 - damp(4, 0.05)) ** 2;
    expect(twiceHalf).toBeCloseTo(once);
  });
});

describe('random', () => {
  test('the same seed gives the same city', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  test('values fall in [0, 1)', () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) expect(r()).toBeWithin(0, 1);
  });
});

describe('storage', () => {
  test('falls back when storage is unavailable', () => {
    expect(readFlag('cv-avenue:test', true)).toBe(true);
    expect(() => writeFlag('cv-avenue:test', false)).not.toThrow();
    expect(readNumber('cv-avenue:test-score', 7)).toBe(7);
    expect(() => writeNumber('cv-avenue:test-score', 1200)).not.toThrow();
  });
});
