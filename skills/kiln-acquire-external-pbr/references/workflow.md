# External PBR acquire workflow

## MCP configuration

Add the 3d-asset-server MCP alongside `kiln_workspace` in the harness config (remote
`https://3d.shep.bot/mcp` or a local checkout). Verify both with a trivial call before authoring.

## 1. Search and licence

```text
search_assets({ query: "oak wood planks", asset_type: "material" })
get_asset({ id: "..." })
```

Check:

- `license` / SPDX (prefer `CC0-1.0`)
- `downloadable: true` (otherwise stop and send the user to `url`)
- Map types offered (albedo, normal, roughness, metallic, AO, ARM/ORM)

Copy attribution strings verbatim for later `kiln_save` metadata.

## 2. Download into the workspace

Use `download_asset` into `assets/external/<provider>/<slug>/`. Keep original filenames for
`originalFiles` hashes. Never check these bytes into git; use `assets/external/.gitignore` with `*`
and `!.gitignore` if needed.

## 3. Slot mapping and ORM

| Source file pattern | Kiln slot | Notes |
| --- | --- | --- |
| `*Color*`, `*Diffuse*`, `*Albedo*` | `baseColor` | sRGB |
| `*NormalGL*` (preferred) or `*Normal*` | `normal` | `normalConvention: "opengl"` |
| `*Roughness*` + `*Metallic*` | combine or separate | Often packed into `metallicRoughness` |
| `*AO*`, `*Occlusion*` | `occlusion` or ORM red channel | Pack per glTF: R=AO, G=roughness, B=metal |
| `*ORM*`, `*ARM*` | `metallicRoughness` | `channelPacking: "r-occlusion-g-roughness-b-metallic"` |

When ambientCG ships separate maps, either pack ORM offline or assign AO to the red channel of
`metallicRoughness` and leave the dedicated `occlusion` slot empty.

## 4. `kiln_material` import

Kiln does not fetch URLs. Read files in the host and call `import` with a payload like:

```json
{
  "action": "import",
  "records": [
    {
      "manifest": { "...": "see material library schema" },
      "files": { "baseColor.png": "<base64>", "normal.png": "<base64>" }
    }
  ]
}
```

Or use CLI `material import --file normalized-payload.json`. The host normalizes JPEG/WebP and
oversized images to PNG ≤4096 px at import time.

Each external source needs:

```json
{
  "id": "poly-haven-oak",
  "kind": "external",
  "provider": "Poly Haven",
  "assetUrl": "https://polyhaven.com/a/oak_planks",
  "creator": "Poly Haven",
  "license": {
    "spdx": "CC0-1.0",
    "url": "https://polyhaven.com/license",
    "attribution": ""
  },
  "originalFiles": [
    { "name": "oak_planks_diff_1k.jpg", "sha256": "sha256:...", "bytes": 12345 }
  ]
}
```

`originalFiles.sha256` must be the **downloaded file** digest; stored map bytes are normalized PNG.

## 5. Pin and compile

```json
{ "resourceId": "oak-planks", "revisionId": "sha256:...", "sha256": "sha256:..." }
```

In program source:

```javascript
const material = await compilePortableMaterialSpecV2(portableSpec);
createPart('Wall', wallGeo, material, { parent: root });
autoUnwrap(wallGeo, { method: 'box' });
```

## 6. Render, validate, save

Run `kiln_render` (GPU when material fidelity matters). Use compact review output by default;
request `detail: "full"` only for a qualified second look at QA findings.

`kiln_save` should retain `build.dependencies` for `kiln.material.v1` and mention attribution in
the brief or description. Deliver licence text in the exported asset bundle per project policy.

## Reference GLB sidecar

When a downloaded model is only a visual target, write `reference.provenance.json` next to it:

```json
{
  "schemaVersion": 1,
  "referenceGlbSha256": "sha256:...",
  "license": { "spdx": "CC0-1.0", "url": "...", "attribution": "..." },
  "provider": "Kenney",
  "assetUrl": "https://..."
}
```

Compare with `bun scripts/compare-reference-glb.mjs` — outside the QA gate.
