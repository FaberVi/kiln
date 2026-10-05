import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { meshGeo } from '../geometry';
import { inspectMeshOrientationConflicts } from './mesh-topology';

test('orientation conflicts emit export warnings and QA observations', async () => {
  const geometry = meshGeo({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
    indices: [0, 1, 2, 3, 1, 2],
  });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = 'Mesh_Flip';
  const root = new THREE.Group();
  root.name = 'Root';
  root.add(mesh);

  const { warnings, findings } = inspectMeshOrientationConflicts(root);
  expect(warnings[0]).toContain('GEO_MESH_ORIENTATION_CONFLICTS');
  expect(findings[0]?.code).toBe('GEO_MESH_ORIENTATION_CONFLICTS');
  expect(findings[0]?.disposition).toBe('observe');

  expect(findings[0]?.measurement?.actual).toBe(1);
});
