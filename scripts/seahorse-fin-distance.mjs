/**
 * Measure min distance from dorsal fin base vertices to body mesh (pre-union).
 *   KILN_RENDER=cpu node scripts/seahorse-fin-distance.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';

import { resolveEvaluatorPortV2 } from '../src/evaluator/protocol.ts';
import { catmullRomPath, taperedTube } from '../src/organic.ts';
import { sweepProfile } from '../src/sweep.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

function applyPartScale(pos, scale) {
  return [pos[0] * scale[0], pos[1] * scale[1], pos[2] * scale[2]];
}

function sampleBodyAndFin() {
  const trunkCtrl = [
    [0, 0.046, 0.042],
    [0, 0.12, 0.028],
    [0, 0.19, 0.046],
    [0, 0.25, 0.062],
    [0, 0.3, 0.05],
    [-0.004, 0.34, 0.018],
    [-0.003, 0.362, -0.006],
    [-0.002, 0.376, -0.016],
  ];
  const spinePath = catmullRomPath(trunkCtrl, 8);
  const ring = (i) => 1 + 0.055 * Math.sin(i * 1.15);
  const spineRadii = spinePath.map((_, i, a) => {
    const t = i / (a.length - 1);
    const belly = t > 0.32 && t < 0.78 ? 0.042 * Math.sin(((t - 0.32) / 0.46) * Math.PI) : 0;
    const neck = t > 0.82 ? 0.028 - (t - 0.82) * 0.07 : 0;
    const core = 0.014 + (1 - t) * 0.008;
    return Math.max(0.008, (core + belly + neck) * ring(i));
  });

  function spineAtY(targetY) {
    let idx = 0;
    for (let i = 1; i < spinePath.length; i++) {
      if (Math.abs(spinePath[i][1] - targetY) < Math.abs(spinePath[idx][1] - targetY)) idx = i;
    }
    return { point: spinePath[idx], radius: spineRadii[idx] };
  }

  const bodyGeo = taperedTube(spinePath, spineRadii, { radialSegments: 28, creaseAngle: 180 });
  const bodyScale = [0.48, 1, 1];

  const finReach = 0.026;
  const finProfile = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    finProfile.push([
      Math.cos(a) * finReach * 0.52,
      Math.sin(a) * finReach - (i === 0 || i === 10 ? 0.008 : 0),
    ]);
  }
  const finYs = [0.238, 0.268, 0.298, 0.318];
  const finPath = finYs.map((y) => {
    const { point, radius } = spineAtY(y);
    return [point[0], point[1] + radius - 0.006, point[2]];
  });
  const dorsalGeo = sweepProfile(finProfile, catmullRomPath(finPath, 3), {
    cap: true,
    creaseAngle: 68,
    up: [0, 0, 1],
  });

  bodyGeo.applyMatrix4(new THREE.Matrix4().makeScale(...bodyScale));
  dorsalGeo.applyMatrix4(new THREE.Matrix4().makeScale(...bodyScale));

  const bodyMesh = new THREE.Mesh(bodyGeo);
  const finPos = dorsalGeo.getAttribute('position');
  const baseVerts = [];
  for (let i = 0; i < finPos.count; i++) {
    const y = finPos.getY(i);
    const z = finPos.getZ(i);
    if (Math.abs(y - 0.238) < 0.04 || Math.abs(y - 0.268) < 0.04) {
      if (z < finPath[0][2] * bodyScale[2] + 0.002) baseVerts.push(new THREE.Vector3(finPos.getX(i), y, z));
    }
  }

  const ray = new THREE.Raycaster();
  let minDist = Infinity;
  for (const v of baseVerts.length ? baseVerts : [new THREE.Vector3(0, 0.278, -0.01)]) {
    for (const dir of [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
    ]) {
      ray.set(v, dir);
      const hits = ray.intersectObject(bodyMesh, false);
      if (hits[0]) minDist = Math.min(minDist, hits[0].distance);
    }
  }

  const bodyPos = bodyGeo.getAttribute('position');
  for (let i = 0; i < finPos.count; i++) {
    const fv = new THREE.Vector3(finPos.getX(i), finPos.getY(i), finPos.getZ(i));
    for (let j = 0; j < bodyPos.count; j += 3) {
      const bv = new THREE.Vector3(bodyPos.getX(j), bodyPos.getY(j), bodyPos.getZ(j));
      minDist = Math.min(minDist, fv.distanceTo(bv));
    }
  }

  return minDist;
}

async function main() {
  const minDist = sampleBodyAndFin();
  console.log(`fin-body min vertex distance (scaled): ${minDist.toFixed(6)}`);

  const path = join(REPO, 'benchmark', 'organic-comparison', 'after', 'seahorse.kiln.js');
  const code = await readFile(path, 'utf8');
  const evaluator = resolveEvaluatorPortV2(undefined, 'trusted-local');
  const rendered = await evaluator.render(code);
  const qa = rendered.meta?.qaReport?.acceptance ?? 'unknown';
  console.log(`seahorse QA: ${qa}`);
  if (minDist > 0.002) {
    process.exitCode = 1;
    console.error('fin still appears separated from body (minDist > 0.002)');
  }
}

await main();
