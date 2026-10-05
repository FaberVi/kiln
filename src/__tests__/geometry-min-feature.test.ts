import { describe, expect, test } from 'bun:test';
import { boxGeo } from '../primitives';
import { geometryMinFeatureAdvisory, meshGeo, topologyAdvisoriesForGeometry } from '../geometry';
import { profileMinFeatureWarnings } from '../geometry-min-feature';

describe('geometryMinFeatureAdvisory', () => {
  test('warns when the thinnest extent is below tolerance ratio', () => {
    const thinPlate = meshGeo({
      positions: [0, 0, 0, 1, 0, 0, 0, 1e-8, 0],
      indices: [0, 1, 2],
    });
    const report = geometryMinFeatureAdvisory(thinPlate, { tolerance: 1e-5, toleranceRatio: 8 });
    expect(report.belowThreshold).toBe(true);
    expect(report.warnings.join(' ')).toContain('diagnostic tolerance');
  });

  test('does not warn on a comfortably thick primitive box', () => {
    const solid = boxGeo(0.4, 0.4, 0.4);
    const report = geometryMinFeatureAdvisory(solid);
    expect(report.belowThreshold).toBe(false);
    expect(report.warnings).toEqual([]);
  });

  test('feeds geometryDiagnostics advisories companion list', () => {
    const thin = meshGeo({
      positions: [0, 0, 0, 0.2, 0, 0, 0.2, 1e-7, 0, 0, 1e-7, 0],
      indices: [0, 1, 2, 0, 2, 3],
    });
    const { advisories } = topologyAdvisoriesForGeometry(thin, 1e-5);
    expect(advisories.some((line) => line.includes('Min feature scale'))).toBe(true);
  });
});

describe('profileMinFeatureWarnings', () => {
  test('warns before bevel when the outline is extremely thin', () => {
    const warnings = profileMinFeatureWarnings(
      [
        [0, 0],
        [0.01, 0],
        [0.01, 1e-9],
        [0, 1e-9],
      ],
      { bevel: 1e-10 },
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('stays quiet on a wide bracket outline', () => {
    expect(
      profileMinFeatureWarnings(
        [
          [0, 0],
          [0.4, 0],
          [0.4, 0.08],
          [0.08, 0.08],
          [0.08, 0.4],
          [0, 0.4],
        ],
        { bevel: 0.01 },
      ),
    ).toEqual([]);
  });
});
