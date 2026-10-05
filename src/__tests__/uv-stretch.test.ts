import { describe, expect, it } from 'bun:test';
import * as THREE from 'three';
import { boxGeo, cylinderGeo } from '../primitives';
import { meshGeo } from '../geometry';
import { geometryTopologyAdvisories, geometryDiagnostics } from '../geometry';
import {
  equalizeUvChartTexelScale,
  measureUvTexelDensity,
  UV_TEXEL_SPREAD_ADVISORY_RATIO,
} from '../uv-stretch';
import { autoUnwrap } from '../uv';
import { boolDiff } from '../solids';
import { gameMaterial } from '../primitives';

function twoChartGeometry(): THREE.BufferGeometry {
  // Two disconnected quads in world space with the same 1×1 size but very different UV scale.
  return meshGeo({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0, 3, 1, 0],
    indices: [0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7],
    uvs: [0, 0, 0.1, 0, 0, 0.1, 0.1, 0.1, 0, 0, 1, 0, 0, 1, 1, 1],
  });
}

describe('measureUvTexelDensity', () => {
  it('reports near-uniform density on primitive box UVs', () => {
    const metrics = measureUvTexelDensity(boxGeo(1, 1, 1));
    expect(metrics).not.toBeNull();
    expect(metrics!.spreadRatio).toBeLessThan(1.05);
    expect(metrics!.minMedianRatio).toBeGreaterThan(0.95);
  });

  it('detects mismatched chart scales', () => {
    const metrics = measureUvTexelDensity(twoChartGeometry());
    expect(metrics!.chartCount).toBe(2);
    expect(metrics!.minMedianRatio).toBeLessThan(0.02);
    expect(metrics!.spreadRatio).toBeGreaterThanOrEqual(1);
  });
});

describe('equalizeUvChartTexelScale', () => {
  it('pulls chart medians together without changing topology', () => {
    const source = twoChartGeometry();
    const before = measureUvTexelDensity(source)!;
    const { geometry, applied, metricsAfter } = equalizeUvChartTexelScale(source);
    expect(applied).toBe(true);
    expect(metricsAfter.minMedianRatio).toBeGreaterThan(before.minMedianRatio * 50);
    expect(metricsAfter.minMedianRatio).toBeGreaterThan(0.9);
    expect(geometry.getIndex()!.count).toBe(source.getIndex()!.count);
    const warnings = geometry.userData.kilnAttributeWarnings as { code: string }[];
    expect(warnings.some((w) => w.code === 'UV_TEXEL_SCALE_EQUALIZED')).toBe(true);
  });

  it('is a no-op when spread is already low', () => {
    const source = boxGeo(1, 1, 1);
    const { geometry, applied } = equalizeUvChartTexelScale(source);
    expect(applied).toBe(false);
    expect(geometry).toBe(source);
  });
});

describe('geometryTopologyAdvisories UV stretch', () => {
  it('suggests remediation when texel density is badly non-uniform', () => {
    const geometry = twoChartGeometry();
    const diagnostics = geometryDiagnostics(geometry);
    const notes = geometryTopologyAdvisories(diagnostics, geometry).join(' ');
    expect(notes).toContain('uvTexelDensity');
    expect(notes).toContain('equalizeUvChartTexelScale');
  });

  it('stays quiet on uniform primitive UVs', () => {
    const geometry = boxGeo(2, 1, 0.5);
    const diagnostics = geometryDiagnostics(geometry);
    const notes = geometryTopologyAdvisories(diagnostics, geometry);
    expect(notes.some((n) => n.startsWith('uvTexelDensity'))).toBe(false);
  });
});

describe('autoUnwrap equalizeChartTexelScale option', () => {
  it('accepts the opt-in post-pass on CSG output', async () => {
    const mat = gameMaterial(0x8899aa);
    const body = new THREE.Mesh(boxGeo(2, 0.4, 2), mat);
    const bore = new THREE.Mesh(cylinderGeo(0.3, 0.3, 2, 24), mat);
    bore.updateMatrixWorld(true);
    const carved = await boolDiff('Plate', body, bore);
    const unwrapped = await autoUnwrap(carved.geometry, {
      resolution: 512,
      equalizeChartTexelScale: true,
    });
    const metrics = measureUvTexelDensity(unwrapped);
    expect(metrics).not.toBeNull();
    expect(metrics!.spreadRatio).toBeLessThan(UV_TEXEL_SPREAD_ADVISORY_RATIO);
  });
});
