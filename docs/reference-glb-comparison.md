# Reference GLB comparison (offline)

Compare a downloaded reference model against a Kiln-exported GLB for human or CI
observation. This harness is **not** part of the QA gate and does not replace the
photo-based `reference-comparison` rule.

## What it does

1. Loads both GLBs with the CPU geometry-flat adapter (`loadGlbGeometryFlatScene`).
2. Aligns each mesh set to a unit bounding box (center + uniform scale).
3. Renders the same six orthographic views as the default contact sheet.
4. Scores silhouette agreement per view (IoU) using the same segmentation math as
   `src/qa/reference-comparison.ts`.
5. Writes a JSON report and a PNG grid (reference | candidate | diff per view).

## CLI

From a Kiln checkout or workspace with the engine on the module path:

```bash
bun scripts/compare-reference-glb.mjs \
  --reference /path/to/reference.glb \
  --candidate /path/to/kiln.glb \
  --out comparison-report.json \
  --grid comparison-grid.png \
  --provenance /path/to/reference.provenance.json
```

`--provenance` is optional. When supplied, its object is copied into the report
(use the schema in `skills/kiln-acquire-external-pbr/references/provenance-template.json`
for material downloads; reference GLB sidecars use `referenceGlbSha256` and licence fields).

## Library API

Import from `src/glb-reference-comparison.ts` in a source checkout (for example
`import { compareReferenceGlbs } from '../src/glb-reference-comparison.ts'` in Bun).

## Limitations

- CPU flat shading only; texture or PBR differences are ignored.
- Alignment is axis-aligned bounding box only (no ICP or manual registration).
- Skinned, morphed, or heavily instanced reference files may load with warnings or
  incomplete geometry.

Do not wire this score into `kiln_validate` or default QA without an explicit product
decision.
