# Organic modeling upstream proposal (fork-only)

Prepared for **matthew-kissinger/kiln** from **FaberVi/kiln**. Do **not** open upstream issues or PRs from this document alone; it records branch names, gate results, and draft text for a maintainer conversation.

**Base:** `upstream/main` at `a6d2aa3` (rebased slices). **Package version on each slice:** `0.11.0` with committed `dist/` from `bun run build:runtime`.

## Fork branches (push to `FaberVi/kiln`)

| Order | Branch | Tip | Scope |
| --- | --- | --- | --- |
| 1 | `cursor/upstream-organic-qa-e104` | `cea4efa` | QA topology rule for `kilnSolidRock`, `summarizeAxisAlignedFacets` helper + tests |
| 2 | `cursor/upstream-organic-helpers-e104` | `50effbf` | Organic helpers, discovery, docs/skills (no QA topology test; independent of PR 1) |
| 3 | `cursor/upstream-organic-benchmark-e104` | `4bfdaa4` | Before/after benchmark, examples, compare/guard scripts |

Each slice also includes the mechanical **0.11.0** collateral: `src/engine-identity.ts`, `dist/`, and small test adjustments in `scripts/tier2-dogfood.test.mjs`, `src/__tests__/mcp-startup.test.ts`, and `src/__tests__/workspace-bootstrap.test.ts`.

## CONTRIBUTING gates (per branch, `KILN_RENDER=cpu`)

Commands: `bun run check:toolchain`, `check:skills`, `typecheck`, `lint`, `test`, `test:render-service`, `test:coverage`.

| Branch | Result | Notes |
| --- | --- | --- |
| `cursor/upstream-organic-qa-e104` | **Pass** | 3190 pass, 3 skip, 0 fail; coverage functions 95.09%, lines 92.30% |
| `cursor/upstream-organic-helpers-e104` | **Pass** | 3197 pass, 3 skip, 0 fail; coverage functions 95.12%, lines 92.36% |
| `cursor/upstream-organic-benchmark-e104` | **Pass** | 3208 pass, 3 skip, 0 fail; coverage functions 95.13%, lines 92.36% |

## Maintainer opening message (draft)

> Hi Matthew — I’ve been experimenting on a fork with higher-level **organic authoring** helpers (metaballs, tapered tubes, paths, rock displacement) and a small **before/after benchmark** to compare legacy-only programs against the new surface.
>
> I split the work into **three focused PRs** rebased on your current `main`, each passing the full CONTRIBUTING gate on its own. I haven’t opened anything upstream yet; I wanted to ask whether you’re interested in this direction before I propose anything.
>
> The series is: (1) QA topology guard for tagged rock meshes plus a reusable axis-aligned facet helper for spotting bounds clipping, (2) the public helper APIs and discovery/docs, (3) the benchmark, examples, and comparison script. The seahorse subject in the benchmark is intentionally documented as a **hard example** with known head/snout and dorsal-fin limitations — we stopped iterating on it.
>
> Most of the implementation was built with **AI coding agents** (Cursor Cloud Agents) on top of your engine, with the usual offline tests and CPU renders as guardrails.
>
> If this isn’t a fit for upstream, no worries — happy to keep it on the fork. If it is, I can open PRs in the order above whenever you prefer.

---

## PR 1 — QA topology + facet helper

**Title:** `feat(qa): block open kilnSolidRock meshes and add axis-aligned facet helper`

**Description:**

### Problem

Rock-style meshes produced by Voronoi displacement or partial shells can reach export with boundary edges while still looking plausible in a render. Authors also hit **implicit/metaball bounds** clipping, which shows up as large flat axis-aligned facets on an otherwise organic mesh; there was no small, testable helper to quantify that pattern.

### Resulting behavior

- Universal QA adds **`UNIVERSAL_MESH_TOPOLOGY`** blocking when `geometry.userData.kilnSolidRock` is set and the mesh has boundary or non-manifold edges (open rock shells fail review).
- New **`summarizeAxisAlignedFacets`** in `src/qa/axis-aligned-facet.ts` reports dominant axis-aligned face area fractions (used by tests and by the organic benchmark guards; **not** wired into the global deterministic QA registry, to avoid false positives on primitive boxes).
- Requirements applicability and registry tests updated for the new rule count.
- Version bumped to **0.11.0**; `dist/` rebuilt.

### Checks run

```sh
bun install --frozen-lockfile
bun run check:toolchain
bun run check:skills
bun run typecheck
bun run lint
bun run test
bun run test:render-service
bun run test:coverage
```

---

## PR 2 — Organic authoring helpers

**Title:** `feat(organic): metaball, tube, path, and rock authoring helpers`

**Description:**

### Problem

Authoring stylised creatures, trees, and rocks with only primitives, sweeps, and CSG requires a lot of boilerplate (path sampling, taper radii, metaball bounds, rock displacement). Discovery and the geometry-recipes skill did not document a cohesive “organic” surface.

### Resulting behavior

- New module **`src/organic.ts`** with **`metaballSurface`**, **`taperedTube`** (including **`sectionScale`**), **`catmullRomPath`**, **`spiralPath`**, **`smoothOrganic`**, **`rockDisplace`**, **`rockBoulder`**, plus mesh metrics helpers.
- **`src/sdf.ts`**: **`smoothUnion`**, **`sphereInside`** for implicit blending.
- Helpers exported from **`primitives`** sandbox; **geometry catalog** and **helper-contracts** discovery entries; **`docs/geometry.md`** and **`skills/kiln-author-asset/references/geometry-recipes.md`** updated.
- Unit tests in **`src/__tests__/organic.test.ts`** and **`sdf.test.ts`** (topology QA test omitted here so this PR stays independent of PR 1).
- Version **0.11.0**; `dist/` rebuilt.

### Checks run

Same CONTRIBUTING list as PR 1 (all pass on `cursor/upstream-organic-helpers-e104`).

---

## PR 3 — Organic benchmark and examples

**Title:** `feat(benchmark): organic before/after comparison programs and examples`

**Description:**

### Problem

It is hard to judge whether new organic helpers improve real authoring without fixed subjects, legacy-only baselines, and reproducible CPU comparison renders.

### Resulting behavior

- **`benchmark/organic-comparison/`** — paired `before/` and `after/` programs for five subjects (`stylised-newt`, `pine-tree`, `rock-cluster`, `jellyfish`, `seahorse`) plus README.
- **`scripts/organic-benchmark-compare.mjs`** — CPU six-view sheets, metrics JSON, optional artifact copy.
- **`scripts/organic-benchmark-guards.mjs`** — seahorse regression guards (bbox growth vs reference, axis-aligned facets on named head/snout parts).
- **`examples/organic-*.kiln.js`** mirrored from benchmark after lane; **`examples.test.ts`** extended.
- **Hard example:** see benchmark README — **`seahorse`** is a documented difficult subject (head/snout readability, oversized dorsal fin); **not** a quality target and **not** slated for further iteration in this series.
- Includes PR 1 + PR 2 code so the benchmark branch is self-contained for CI.
- Version **0.11.0**; `dist/` rebuilt; `output/organic-comparison/` gitignored.

### Checks run

Same CONTRIBUTING list as PR 1 (all pass on `cursor/upstream-organic-benchmark-e104`).

### Comparison

Run on the benchmark branch:

```sh
KILN_RENDER=cpu node scripts/organic-benchmark-compare.mjs
```

Outputs under `output/organic-benchmark/` (gitignored). The fork’s integrated organic PR (`cursor/organic-modeling-e104`) carries the same comparison assets used for review.

---

## FaberVi integration PR

The combined fork work remains on **`cursor/organic-modeling-e104`** (PR #1 on FaberVi/kiln). Seahorse limitations and upstream split pointers live in **`benchmark/organic-comparison/README.md`** and this file.
