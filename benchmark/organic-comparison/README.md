# Organic modeling before/after benchmark

Fixed subjects and briefs for comparing legacy-only authoring against the organic
helper surface (`metaballSurface`, `taperedTube`, `catmullRomPath`, `smoothOrganic`,
`rockDisplace`, `smoothUnion`).

| Subject | Brief |
| --- | --- |
| `stylised-newt` | ~0.48 m salamander-like creature, belly on Y=0, +X forward |
| `pine-tree` | ~1.1 m stylised pine on Y=0 |
| `rock-cluster` | Three boulders within 0.75 m footprint |
| `jellyfish` | Bell ~0.22 m diameter, eight tentacles, floating above Y=0 |
| `seahorse` | ~0.32 m tall profile figure on Y=0 |

`before/` programs use only pre-existing APIs (primitive solids, `pipeAlongPath`,
`curveToMesh`, `boolUnion`, low segment counts, default sweep crease angles).
`after/` programs implement the same brief with the organic helpers.

Reproduce renders and metrics:

```sh
KILN_RENDER=cpu node scripts/organic-benchmark-compare.mjs
```

Outputs land under `output/organic-benchmark/` (gitignored) and copied artifacts under
`/opt/cursor/artifacts/` when run in Cloud Agent.
