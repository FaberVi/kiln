import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { boxGeo } from '../primitives';
import { boolUnion } from '../solids';

test('smooth CSG emits a creaseNormals export advisory', async () => {
  const a = new THREE.Mesh(boxGeo(1, 1, 1), new THREE.MeshStandardMaterial());
  a.name = 'A';
  const b = new THREE.Mesh(boxGeo(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial());
  b.position.set(0.25, 0, 0);
  b.name = 'B';
  const result = await boolUnion('Union', a, b, { smooth: true });
  const notes = result.geometry.userData.kilnAttributeWarnings as { code: string }[];
  expect(notes.some((n) => n.code === 'CSG_SMOOTH_CREASE')).toBe(true);
  expect(result.geometry.userData.kilnCsgSmooth).toBe(true);
});
