---
name: kiln-acquire-external-pbr
description: Acquire stock PBR maps via 3d-asset-server MCP, import with kiln_material, pin dependencies, and author with provenance.
license: MIT
metadata:
  kiln-workflow: workspace
---

# Acquire external PBR materials

Use this optional workflow when a brief needs stock surfaces (wood, brick, metal, fabric, ground)
rather than a fully procedural recipe. Pair the workspace `kiln_workspace` MCP server with the
[3d-asset-server](https://github.com/arielshad/3d-asset-server) MCP (`search_assets`,
`get_asset`, `download_asset`, `list_providers`).

Read the [step-by-step workflow](references/workflow.md) for slot mapping, ORM packing, and save
provenance. Do not commit third-party texture binaries to the engine repository; keep downloads in
the workspace only.

## When to search vs generate procedurally

| Prefer 3d-asset-server | Prefer Kiln procedural / `kiln_discover` |
| --- | --- |
| Named stock materials and surfaces | Parametric dimensions, rigs, vehicles, characters |
| CC0 (or approved) downloadable PBR sets | No suitable CC0 match or `downloadable=false` |
| Tileable albedo/normal/ORM from ambientCG, Poly Haven, Kenney | QA-heavy bespoke geometry with no texture reuse |

Search in plain language ("weathered oak planks", "red brick wall"). Prefer **CC0-1.0**; record
SPDX, attribution text, provider, and source URL even when attribution is empty.

## Workspace layout

```text
assets/external/<provider>/<asset-id>/   # downloaded maps (gitignored)
assets/external/PROVENANCE.json          # optional index; see references/provenance-template.json
```

Register both MCP servers in the harness. Order: search → `get_asset` licence check →
`download_asset` → normalize/import → pin → program → `kiln_render` / `kiln_validate` →
`kiln_save`.

## Kiln import (summary)

1. Map files to library slots: `baseColor`, `normal` (OpenGL), `metallicRoughness` (glTF ORM:
   R=occlusion, G=roughness, B=metallic), optional `occlusion` when not packed.
2. Build a `kiln_material` import payload with embedded bytes, `kind: "external"` sources, and
   `originalFiles` hashes of the **downloaded** files (import normalizes JPEG/WebP and downscales
   to ≤4096 px PNG for GPU review).
3. Pin `materialDependencies` before `compilePortableMaterialSpecV2` / `loadApprovedTexture`.
4. Call `autoUnwrap` or explicit UVs on textured meshes; QA blocks materials without `TEXCOORD_0`.
5. Save with dependency closure and attribution in the asset brief or description.

CLI equivalents: `node kiln.mjs material import --file payload.json`, then `material get` for
`portableSpec`. Use `--render gpu` when PBR appearance must be evidenced.

## Reference GLBs

Downloaded models are **observation references** only. Compare them to a Kiln GLB with
`bun scripts/compare-reference-glb.mjs` (see `docs/reference-glb-comparison.md`). Do not treat
that score as QA acceptance.
