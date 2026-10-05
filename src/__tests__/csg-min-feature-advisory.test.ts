import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { boxGeo } from '../primitives';
import { boolUnion } from '../solids';

test('CSG records GEO_MIN_FEATURE when an operand is thinner than tolerance ratio', async () => {
  const thick = new THREE.Mesh(boxGeo(1, 1, 1), new THREE.MeshStandardMaterial());
  thick.name = 'Thick';
  const thin = new THREE.Mesh(boxGeo(0.2, 0.2, 1e-8), new THREE.MeshStandardMaterial());
  thin.position.set(0.1, 0, 0);
  thin.name = 'Thin';
  const result = await boolUnion('Union', thick, thin);
  const notes = (result.geometry.userData.kilnGeometryWarnings ?? []) as { code: string }[];
  expect(notes.some((n) => n.code === 'GEO_MIN_FEATURE')).toBe(true);
});
