/** Synthetic GLBs for reference-comparison tests and offline examples (no third-party assets). */
import { Document, WebIO } from '@gltf-transform/core';

const io = new WebIO();

const UNIT_BOX_POSITIONS = new Float32Array(
  [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ].flat(),
);

const UNIT_BOX_INDICES = new Uint16Array([
  0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 5, 6, 1, 6, 2, 0, 1, 5, 0, 5, 4, 3, 2, 6,
  3, 6, 7,
]);

export async function createSyntheticBoxGlbBytes(
  scale: [number, number, number] = [1, 1, 1],
  translation: [number, number, number] = [0, 0, 0],
): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(UNIT_BOX_POSITIONS)
    .setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(UNIT_BOX_INDICES)
    .setBuffer(buffer);
  const material = doc
    .createMaterial('Box')
    .setBaseColorFactor([0.75, 0.35, 0.2, 1])
    .setDoubleSided(true);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', positions)
    .setIndices(indices)
    .setMaterial(material);
  doc
    .createScene('Scene')
    .addChild(
      doc
        .createNode('Box')
        .setMesh(doc.createMesh('BoxMesh').addPrimitive(primitive))
        .setScale(scale)
        .setTranslation(translation),
    );
  return await io.writeBinary(doc);
}
