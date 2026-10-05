import { describe, expect, test } from 'bun:test';
import { segmentsFromRadius } from '../geometry-segments';

describe('segmentsFromRadius', () => {
  test('scales with radius and clamps to min/max', () => {
    expect(segmentsFromRadius(0.02)).toBeGreaterThanOrEqual(8);
    expect(segmentsFromRadius(0.02)).toBeLessThanOrEqual(12);
    const hero = segmentsFromRadius(0.35);
    expect(hero).toBeGreaterThan(16);
    expect(hero).toBeLessThanOrEqual(128);
    expect(segmentsFromRadius(5, { max: 64 })).toBeLessThanOrEqual(64);
  });

  test('honors maxChordLength', () => {
    const coarse = segmentsFromRadius(0.5, { maxChordLength: 0.5 });
    const fine = segmentsFromRadius(0.5, { maxChordLength: 0.05 });
    expect(fine).toBeGreaterThan(coarse);
  });

  test('rejects invalid radius', () => {
    expect(() => segmentsFromRadius(0)).toThrow();
    expect(() => segmentsFromRadius(NaN)).toThrow();
  });
});
