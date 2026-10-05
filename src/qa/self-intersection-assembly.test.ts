import { expect, test } from 'bun:test';
import * as THREE from 'three';
import {
  analyzePartPenetration,
  inspectPartPenetration,
  partPenetrationContactFraction,
  CONTACT_VOLUME_FRACTION,
  ASSEMBLY_PENETRATION_CONTACT_FRACTION,
} from './self-intersection';
import { createAssetRequirementsV1 } from '../contracts/requirements';
import { createAssetRequirementsStore } from '../requirements-store';
import { resolveRequirementsContext } from '../requirements-context';
import { collectRequirementsSceneEvidence, runRequirementsSceneQa } from './requirements-run';

function boxAt(name: string, size: [number, number, number], pos: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial());
  mesh.name = name;
  mesh.position.set(...pos);
  return mesh;
}

test('assembly labels raise the contact fraction without hiding large overlaps', () => {
  expect(partPenetrationContactFraction({ labels: ['prop'] })).toBe(CONTACT_VOLUME_FRACTION);
  expect(partPenetrationContactFraction({ labels: ['vehicle'] })).toBe(
    ASSEMBLY_PENETRATION_CONTACT_FRACTION,
  );
  expect(partPenetrationContactFraction({ labels: ['architecture'] })).toBe(
    ASSEMBLY_PENETRATION_CONTACT_FRACTION,
  );
});

test('small assembly overlaps summarize instead of listing every pair', async () => {
  const root = new THREE.Group();
  root.add(boxAt('Mesh_A', [1, 1, 1], [0, 0, 0]), boxAt('Mesh_B', [1, 1, 1], [0.99, 0, 0]));
  const prop = await analyzePartPenetration(root, { labels: ['prop'] });
  const vehicle = await analyzePartPenetration(root, { labels: ['vehicle'] });
  expect(prop.penetrations.length).toBeGreaterThan(0);
  expect(vehicle.penetrations.length).toBe(0);
  expect(vehicle.assemblyJointsSuppressed).toBeGreaterThan(0);
  const findings = inspectPartPenetration(vehicle);
  expect(findings.some((f) => f.code === 'GEO_PART_SELF_INTERSECTION_ASSEMBLY_JOINTS')).toBe(true);
});

test('large accidental overlaps still surface under assembly labels', async () => {
  const root = new THREE.Group();
  root.add(boxAt('Mesh_A', [1, 1, 1], [0, 0, 0]), boxAt('Mesh_B', [1, 1, 1], [0.5, 0, 0]));
  const vehicle = await analyzePartPenetration(root, { labels: ['vehicle'] });
  expect(vehicle.penetrations.length).toBe(1);
});

test('requirements host labels flow into penetration policy', async () => {
  const root = new THREE.Group();
  root.add(boxAt('Mesh_A', [1, 1, 1], [0, 0, 0]), boxAt('Mesh_B', [1, 1, 1], [0.99, 0, 0]));
  const binding = createAssetRequirementsStore().host.bind(
    { taskId: 'assembly', lineageId: 'one' },
    createAssetRequirementsV1({ labels: ['architecture'] }),
    { actor: 'host', source: 'brief', reason: 'assembly overlap policy' },
  );
  const context = resolveRequirementsContext(binding);
  const evidence = await collectRequirementsSceneEvidence(context, root);
  const qa = runRequirementsSceneQa(context, root, [], {}, evidence);
  const overlapFindings = qa.dimensions.visualQuality.findings.filter((f) =>
    f.code.startsWith('GEO_PART_SELF_INTERSECTION'),
  );
  expect(overlapFindings.some((f) => f.code === 'GEO_PART_SELF_INTERSECTION_ASSEMBLY_JOINTS')).toBe(
    true,
  );
  expect(overlapFindings.some((f) => f.code === 'GEO_PART_SELF_INTERSECTION')).toBe(false);
});
