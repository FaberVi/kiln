import { describe, expect, test } from 'bun:test';
import { Document, WebIO } from '@gltf-transform/core';
import { compareReferenceGlbs, sha256Glb } from './glb-reference-comparison';

const io = new WebIO();

async function boxGlb(
  scale: [number, number, number],
  translation: [number, number, number],
): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(
      new Float32Array([
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5,
        -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      ]),
    )
    .setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(
      new Uint16Array([
        0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 5, 6, 1, 6, 2, 0, 1, 5, 0, 5, 4, 3,
        2, 6, 3, 6, 7,
      ]),
    )
    .setBuffer(buffer);
  const material = doc.createMaterial().setBaseColorFactor([0.8, 0.2, 0.2, 1]);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', positions)
    .setIndices(indices)
    .setMaterial(material);
  doc
    .createScene()
    .addChild(
      doc
        .createNode()
        .setMesh(doc.createMesh().addPrimitive(primitive))
        .setScale(scale)
        .setTranslation(translation),
    );
  return await io.writeBinary(doc);
}

describe('glb reference comparison harness', () => {
  test('aligned boxes with different world scale score high silhouette agreement', async () => {
    const reference = await boxGlb([2, 1, 0.5], [0, 0, 0]);
    const candidate = await boxGlb([0.8, 0.4, 0.2], [3, 1, -2]);
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
  });

  test('different shapes score lower than identical geometry', async () => {
    const reference = await boxGlb([1, 1, 1], [0, 0, 0]);
    const same = await boxGlb([1, 1, 1], [0, 0, 0]);
    const thin = await boxGlb([0.2, 2, 0.2], [0, 0, 0]);
    const identical = await compareReferenceGlbs(reference, same, { cellSize: 48 });
    const different = await compareReferenceGlbs(reference, thin, { cellSize: 48 });
    expect(identical.report.overallSilhouetteIoU).toBeGreaterThan(
      different.report.overallSilhouetteIoU,
    );
  });
});
