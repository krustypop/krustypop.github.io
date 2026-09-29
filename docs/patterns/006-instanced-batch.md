# 006 — City-wide instanced batch

**Use when** the same small mesh repeats many times across buildings (windows, sills, and later lights, crates, benches…).

**Why:** [ADR 0005](../adr/0005-merged-static-geometry.md).

## Rule

Collect instance transforms in world space while generating, then build one `InstancedMesh` per material at the end. Never create an instanced mesh per building.

## How

Model on `world/windows.ts`:

```js
const batch = createWindowBatch(mats); // 1. create before generating
batch.addBuilding(group.matrix, floors, trim, rand); // 2. called by each building
batch.build(scene); // 3. once, after generation
```

- `addX` composes the local matrix and premultiplies by the owner's world matrix (`placeFacingAvenue` sets and updates it before children are built). Push a `.clone()`: the scratch matrix is reused.
- Per-instance color: pass a `colors` array to `instanced(parent, geometry, material, matrices, colors)` with a white material; instance colors multiply it (sills take their building's trim this way).
- Split by material rather than by color when the material changes over time (`windowLit` vs `windowDark`, see [008](008-time-of-day.md)).

## Pitfalls

- `instanced()` sets `frustumCulled = false`: a city-wide batch spans the avenue, so its bounds are always on screen anyway.
- Consume `rand()` inside `addX` in the same order the old code did, or the lit-window pattern changes ([007](007-seeded-generation.md)).
