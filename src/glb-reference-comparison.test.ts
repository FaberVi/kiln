import { describe, expect, test } from 'bun:test';
import { compareReferenceGlbs, sha256Glb } from './glb-reference-comparison';
import { createSyntheticBoxGlbBytes } from './glb-reference-comparison-fixtures';

describe('glb reference comparison harness', () => {
  test('aligned boxes with different world scale score high silhouette agreement', async () => {
    const reference = await createSyntheticBoxGlbBytes([2, 1, 0.5], [0, 0, 0]);
    const candidate = await createSyntheticBoxGlbBytes([0.8, 0.4, 0.2], [3, 1, -2]);
    const { report, comparisonGridPng } = await compareReferenceGlbs(reference, candidate, {
      cellSize: 64,
      provenance: {
        schemaVersion: 1,
        referenceGlbSha256: sha256Glb(reference),
        license: {
          spdx: 'CC0-1.0',
          url: 'https://creativecommons.org/publicdomain/zero/1.0/',
          attribution: '',
        },
      },
    });
    expect(report.overallSilhouetteIoU).toBeGreaterThan(0.85);
    expect(report.views.length).toBe(6);
    expect(comparisonGridPng.length).toBeGreaterThan(100);
    expect(report.provenance?.referenceGlbSha256).toBe(sha256Glb(reference));
    for (const row of report.views) {
      expect(row.evidence.reference.coverage).toBeGreaterThan(0.08);
      expect(row.evidence.rendered.coverage).toBeGreaterThan(0.08);
    }
  });

  test('different shapes score lower than identical geometry', async () => {
    const reference = await createSyntheticBoxGlbBytes([1, 1, 1], [0, 0, 0]);
    const same = await createSyntheticBoxGlbBytes([1, 1, 1], [0, 0, 0]);
    const thin = await createSyntheticBoxGlbBytes([0.2, 2, 0.2], [0, 0, 0]);
    const identical = await compareReferenceGlbs(reference, same, { cellSize: 48 });
    const different = await compareReferenceGlbs(reference, thin, { cellSize: 48 });
    expect(identical.report.overallSilhouetteIoU).toBeGreaterThan(
      different.report.overallSilhouetteIoU,
    );
  });
});
