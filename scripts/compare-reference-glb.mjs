#!/usr/bin/env node
/**
 * Compare a reference GLB against a Kiln-exported GLB offline (not a QA gate).
 *
 * Usage:
 *   bun scripts/compare-reference-glb.mjs --reference ref.glb --candidate kiln.glb \
 *     --out report.json --grid comparison.png [--provenance provenance.json]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const usage = `Usage:
  bun scripts/compare-reference-glb.mjs --reference PATH --candidate PATH \\
    --out report.json --grid comparison.png [--provenance provenance.json]
`;

function parseArgs(argv) {
  const options = {};
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--reference') {
      options.reference = value;
      i++;
    } else if (flag === '--candidate') {
      options.candidate = value;
      i++;
    } else if (flag === '--out') {
      options.out = value;
      i++;
    } else if (flag === '--grid') {
      options.grid = value;
      i++;
    } else if (flag === '--provenance') {
      options.provenance = value;
      i++;
    } else if (flag === '--help' || flag === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return options;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.reference || !args.candidate || !args.out || !args.grid) {
    console.error(usage);
    process.exit(args.help ? 0 : 1);
  }

  const { compareReferenceGlbs } = await import('../src/glb-reference-comparison.ts');
  const reference = await readFile(resolve(args.reference));
  const candidate = await readFile(resolve(args.candidate));
  let provenance;
  if (args.provenance) {
    provenance = JSON.parse(await readFile(resolve(args.provenance), 'utf8'));
  }

  const { report, comparisonGridPng } = await compareReferenceGlbs(reference, candidate, {
    provenance,
  });
  await writeFile(resolve(args.out), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(args.grid), comparisonGridPng);
  console.log(
    JSON.stringify({
      overallSilhouetteIoU: report.overallSilhouetteIoU,
      report: resolve(args.out),
      grid: resolve(args.grid),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
