import { describe, expect, test } from 'bun:test';
import { subdividePathByCurvature } from '../sweep-path-curvature';

describe('subdividePathByCurvature', () => {
  test('adds stations on a sharp bend and keeps endpoints', () => {
    const sparse = subdividePathByCurvature([
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
    ]);
    const straight = subdividePathByCurvature([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    expect(sparse.length).toBeGreaterThan(straight.length);
    expect(sparse[0]).toEqual([0, 0, 0]);
    expect(sparse[sparse.length - 1]).toEqual([1, 0, 1]);
  });

  test('respects maxStations safety clamp', () => {
    const zigzag = subdividePathByCurvature(
      [
        [0, 0, 0],
        [1, 0, 0],
        [0, 0, 1],
        [1, 0, 2],
        [0, 0, 3],
      ],
      { maxStations: 8, minTurnDegrees: 5, degreesPerStation: 5 },
    );
    expect(zigzag.length).toBeLessThanOrEqual(8);
  });

  test('rejects too-few points', () => {
    expect(() => subdividePathByCurvature([[0, 0, 0]])).toThrow(/at least two/);
  });
});
