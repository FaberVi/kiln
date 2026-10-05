import { expect, test } from 'bun:test';
import type * as THREE from 'three';
import {
  geometryDiagnostics,
  geometryTopologyAdvisories,
  topologyAdvisoriesForGeometry,
} from '../geometry';
import { meshGeo } from '../geometry';
import { buildSandboxGlobals } from '../primitives';

test('geometryTopologyAdvisories notes orientation conflicts and CSG smooth', () => {
  const geometry = meshGeo({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
    indices: [0, 1, 2, 3, 1, 2],
  });
  const diagnostics = geometryDiagnostics(geometry);
  expect(geometryTopologyAdvisories(diagnostics, geometry).join(' ')).toContain(
    'orientationConflicts',
  );
  geometry.userData.kilnCsgSmooth = true;
  expect(geometryTopologyAdvisories(diagnostics, geometry).join(' ')).toContain('creaseNormals');
});

test('sandbox geometryDiagnostics returns advisories alongside counts', () => {
  const geometry = meshGeo({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
    indices: [0, 1, 2, 3, 1, 2],
  });
  const report = topologyAdvisoriesForGeometry(geometry);
  expect(report.diagnostics.orientationConflicts).toBeGreaterThan(0);
  expect(report.advisories.length).toBeGreaterThan(0);
  const sandbox = buildSandboxGlobals() as {
    geometryDiagnostics: (
      geo: THREE.BufferGeometry,
    ) => ReturnType<typeof geometryDiagnostics> & { advisories?: string[] };
  };
  expect(sandbox.geometryDiagnostics(geometry).advisories?.length).toBeGreaterThan(0);
});
