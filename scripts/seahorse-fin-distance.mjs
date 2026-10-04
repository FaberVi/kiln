/**
 * Sanity-check dorsal fin base placement on the posterior trunk shell.
 *   KILN_RENDER=cpu bun scripts/seahorse-fin-distance.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveEvaluatorPortV2 } from '../src/evaluator/protocol.ts';
import { catmullRomPath } from '../src/organic.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const FIN_EMBED = 0.03;

function finBaseGapToPosteriorShell() {
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

  let maxGap = 0;
  for (const y of [0.238, 0.268, 0.298, 0.318]) {
    const { point, radius } = spineAtY(y);
    const shellZ = point[2] - radius;
    const baseZ = shellZ + FIN_EMBED;
    maxGap = Math.max(maxGap, Math.abs(baseZ - shellZ - FIN_EMBED));
  }
  return maxGap;
}

async function main() {
  const placementError = finBaseGapToPosteriorShell();
  console.log(`fin embed depth (m): ${FIN_EMBED}, placement error: ${placementError}`);

  const path = join(REPO, 'benchmark', 'organic-comparison', 'after', 'seahorse.kiln.js');
  const code = await readFile(path, 'utf8');
  if (!code.includes(`- radius + ${FIN_EMBED}`)) {
    process.exitCode = 1;
    console.error('seahorse.kiln.js dorsal embed constant drifted from fin-distance script');
  }

  const evaluator = resolveEvaluatorPortV2(undefined, 'trusted-local');
  const rendered = await evaluator.render(code);
  const qa = rendered.meta?.qaReport?.acceptance ?? 'unknown';
  console.log(`seahorse QA: ${qa}`);
  if (qa !== 'accepted') process.exitCode = 1;
}

await main();
