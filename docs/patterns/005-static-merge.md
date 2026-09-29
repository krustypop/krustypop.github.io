# 005 — Voxel blocks and static merge

**Use when** adding scenery, or anything that must move, animate or be clicked.

**Why:** [ADR 0005](../adr/0005-merged-static-geometry.md).

## Rule

Build scenery from `box()` blocks and let `mergeStatic(scene)` bake them: `solid()` colors are baked into vertex colors and merged into one draw call per castShadow flag, every other opaque material into one draw call per (material, castShadow) pair, and groups left empty are removed. Opt out explicitly for anything dynamic.

## How

- Add blocks with `box(parent, color, [w, h, d], [x, y, z], { shadow })` from `gfx/voxel.ts`. Colors go through `solid(color)`, a shared material per color flagged `userData.solid`: after merging, all of them share one vertex-colored draw call, so new colors are free. Never mutate a `solid()` material (it is baked away); a color that changes at runtime needs its own material.
- Multi-color model that moves as one piece (the hero's limbs): `coloredBlocks([[color, size, pos], …])` gives one vertex-colored geometry.
- Textured board (billboards, contact sign): `signBoard(size, texture, edgeColor)`.
- Things `mergeStatic` leaves alone:
  - subtrees with `userData.dynamic = true` (clouds, anything you move each frame);
  - instanced, transparent and multi-material meshes;
  - materials other than `MeshStandardMaterial` / `MeshBasicMaterial`.
- Clickable object: give its group `userData.target` and a `hitbox(group, size, pos)`. The visible blocks get merged away; the invisible hitbox keeps the group raycastable.

## Pitfalls

- Build the whole static world first; `createWorld` calls `mergeStatic` once, near the end. Meshes added after it stay unmerged (one draw call each).
- A mesh you mutate after the merge (color, position) must be excluded, or you mutate a mesh that no longer exists.
- Merged meshes have `matrixAutoUpdate = false`: moving one does nothing.
- Create every material before `atmosphere.applyFog(scene)` runs in `main.ts`, or it renders without fog. Additive glows set `fog: false` ([ADR 0006](../adr/0006-height-fog-shader-chunk.md)).
- Measure with `/?debug` → `cv.renderer.info.render.calls` before and after.
