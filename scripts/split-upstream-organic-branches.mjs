#!/usr/bin/env node
/**
 * Create three upstream-proposal branches from upstream/main using files on SOURCE_REF.
 * Usage: SOURCE_REF=origin/cursor/organic-modeling-e104 node scripts/split-upstream-organic-branches.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = process.env.SOURCE_REF ?? 'origin/cursor/organic-modeling-e104';
const cwd = '/workspace';
const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd });

const BRANCH_A = 'cursor/upstream-organic-qa-e104';
const BRANCH_B = 'cursor/upstream-organic-helpers-e104';
const BRANCH_C = 'cursor/upstream-organic-benchmark-e104';

const FILES_COLLATERAL = [
  'src/engine-identity.ts',
  'scripts/tier2-dogfood.test.mjs',
  'src/__tests__/mcp-startup.test.ts',
  'src/__tests__/workspace-bootstrap.test.ts',
];

const FILES_A = [
  'src/qa/universal.ts',
  'src/qa/universal.test.ts',
  'src/qa/axis-aligned-facet.ts',
  'src/qa/axis-aligned-facet.test.ts',
  'src/qa/requirements-applicability.ts',
  'src/qa/requirements-applicability.test.ts',
  'src/qa/registry.test.ts',
  ...FILES_COLLATERAL,
];

const FILES_B = [
  'src/organic.ts',
  'src/sdf.ts',
  'src/primitives.ts',
  'src/geometry-catalog.ts',
  'src/discovery/helper-contracts.ts',
  'src/__tests__/organic.test.ts',
  'src/__tests__/sdf.test.ts',
  'docs/geometry.md',
  'skills/kiln-author-asset/references/geometry-recipes.md',
  'src/__tests__/__snapshots__/prompt-api.test.ts.snap',
  ...FILES_COLLATERAL,
];

const FILES_C = [
  'benchmark/organic-comparison',
  'examples/organic-jellyfish.kiln.js',
  'examples/organic-pine-tree.kiln.js',
  'examples/organic-rock-cluster.kiln.js',
  'examples/organic-seahorse.kiln.js',
  'examples/organic-stylised-newt.kiln.js',
  'scripts/organic-benchmark-compare.mjs',
  'scripts/organic-benchmark-guards.mjs',
  'scripts/organic-benchmark-guards.test.mjs',
  'src/__tests__/examples.test.ts',
  '.gitignore',
];

const VERSION_FILES = [
  'package.json',
  'plugin.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
];

function bumpVersion(target) {
  const from = JSON.parse(readFileSync(`${cwd}/package.json`, 'utf8')).version;
  for (const f of VERSION_FILES) {
    const text = readFileSync(`${cwd}/${f}`, 'utf8');
    writeFileSync(`${cwd}/${f}`, text.replaceAll(`"version": "${from}"`, `"version": "${target}"`));
  }
}

function stripTopologyTestFromOrganic() {
  const path = `${cwd}/src/__tests__/organic.test.ts`;
  let text = readFileSync(path, 'utf8');
  text = text.replace(/\n {2}test\('QA blocks open kilnSolidRock meshes',[\s\S]*?\n {2}\}\);\n/, '\n');
  text = text.replace(
    /import { createUniversalQaRegistry } from '\.\.\/qa\/universal';\nimport { createAssetIntentV1 } from '\.\.\/contracts';\n/,
    '',
  );
  text = text.replace(/import \* as THREE from 'three';\n\n/, '');
  writeFileSync(path, text);
}

function appendChangelog(block) {
  const path = `${cwd}/CHANGELOG.md`;
  const text = readFileSync(path, 'utf8');
  const marker = 'from publishing a new installable package.\n\n';
  const needle = block.trim().slice(0, 48);
  if (text.includes(needle)) return;
  writeFileSync(path, text.replace(marker, `${marker}${block}\n`));
}

function buildBranch(name, files, { changelog, postCheckout, commitMessage }) {
  run('git reset --hard upstream/main');
  run(`git checkout -B ${name}`);
  for (const f of files) {
    run(`git checkout ${SOURCE} -- ${f}`);
  }
  bumpVersion('0.11.0');
  appendChangelog(changelog);
  postCheckout?.();
  run('bun run build:runtime');
  const staged = [...files, ...VERSION_FILES, 'CHANGELOG.md', 'dist', 'src/generated/mcp-manifest.json'];
  run(`git add -- ${staged.map((f) => `"${f}"`).join(' ')}`);
  run(`git commit -m "${commitMessage}"`);
}

buildBranch(BRANCH_A, FILES_A, {
  changelog: `- Universal QA: \`UNIVERSAL_MESH_TOPOLOGY\` rejects open meshes tagged \`kilnSolidRock\`.
- \`summarizeAxisAlignedFacets\` helper (and tests) for detecting large axis-aligned facet areas (implicit bounds clipping suspect).`,
  commitMessage: 'feat(qa): rock mesh topology rule and axis-aligned facet helper',
});

buildBranch(BRANCH_B, FILES_B, {
  changelog: `- Organic authoring helpers: \`metaballSurface\`, \`taperedTube\` (incl. \`sectionScale\`), \`catmullRomPath\`, \`spiralPath\`, \`smoothOrganic\`, \`rockDisplace\`, \`rockBoulder\`, and SDF utilities \`smoothUnion\` / \`sphereInside\`. Discovery catalog and geometry-recipes skill updates.`,
  postCheckout: stripTopologyTestFromOrganic,
  commitMessage: 'feat(organic): authoring helpers, discovery and docs',
});

const allC = [...new Set([...FILES_A, ...FILES_B, ...FILES_C])];
buildBranch(BRANCH_C, allC, {
  changelog: `- Organic before/after benchmark under \`benchmark/organic-comparison/\`, example programs, \`scripts/organic-benchmark-compare.mjs\`, and seahorse regression guards (\`scripts/organic-benchmark-guards.mjs\`). See benchmark README for the seahorse hard-example note.`,
  commitMessage: 'feat(benchmark): organic before/after comparison and examples',
});

run('git checkout cursor/organic-modeling-e104');
console.log('Created branches:', BRANCH_A, BRANCH_B, BRANCH_C);
