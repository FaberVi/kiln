import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const bun = process.env.BUN_BIN ?? `${process.env.HOME}/.bun/bin/bun`;

function compressWell(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'kiln-compress-'));
  const outPath = join(dir, `${mode}.glb`);
  const script = `
import { readFileSync, writeFileSync } from 'node:fs';
import { compressGlbBytes } from './src/glb-compress.ts';
const plain = readFileSync('examples/well.glb');
const out = await compressGlbBytes(new Uint8Array(plain), '${mode}');
if (!out) throw new Error('compress failed');
writeFileSync(process.env.KILN_COMPRESS_OUT, Buffer.from(out.bytes));
`;
  const result = spawnSync(bun, ['-e', script], {
    cwd: repo,
    env: { ...process.env, KILN_COMPRESS_OUT: outPath },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(result.stderr || `compress ${mode} failed`);
  }
  const bytes = readFileSync(outPath);
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

test('admission and GLTFLoader accept meshopt and Draco GLBs from kiln compress', async () => {
  const { validateSelfContainedGlb } = await import('../src/glb-input.mjs');
  const { createGltfLoader } = await import('../src/gltf-loader.mjs');
  const { selfContainedResourceUrl } = await import('../src/glb-input.mjs');
  const plain = readFileSync(new URL('../../examples/well.glb', import.meta.url));
  const loader = await createGltfLoader();
  loader.manager.setURLModifier(selfContainedResourceUrl);
  const baseline = await loader.parseAsync(
    plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength),
    '',
  );
  assert.ok(baseline.scene.children.length > 0);
  for (const mode of ['meshopt', 'draco']) {
    const bytes = compressWell(mode);
    validateSelfContainedGlb(Buffer.from(bytes));
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    assert.ok(gltf.scene);
  }
  const { disposeGltfDecoderSingletons } = await import('../src/gltf-loader.mjs');
  disposeGltfDecoderSingletons();
});
