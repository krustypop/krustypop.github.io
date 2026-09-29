# 0005 — Merge static geometry, instance repeated meshes

- **Status:** Accepted
- **Date:** 2026-09-28 (merging), 2026-09-29 (city-wide instancing)

## Context

The voxel look means hundreds of boxes: every block was a mesh, so every block cost a draw call, twice with shadows. Phones are part of the audience, and draw calls are their main bottleneck.

## Options

- **One mesh per block:** simplest to write and to change at runtime; hundreds of draw calls.
- **Bake static meshes by material + instance repeated ones:** few draw calls; baked objects can no longer be moved or edited individually.
- **`THREE.BatchedMesh`:** keeps per-object transforms in one draw call. Not evaluated.

## Decision

After the world is built, `mergeStatic` bakes every opaque static mesh into one mesh per (material, castShadow), and removes the groups it empties. Repeated small meshes (windows, sills) are collected city-wide into `InstancedMesh`es. The hero and each cloud are single meshes.

Measured at the same position and hour: 128 → 89 draw calls, 179 → 98 meshes, 249 → 93 scene root children.

## Consequences

- Anything that moves, animates or must be clicked opts out (`userData.dynamic`) or keeps an invisible `hitbox()`. The mailbox shipped unclickable before this rule, because all its blocks had been merged away: [pattern 005](../patterns/005-static-merge.md), [pattern 006](../patterns/006-instanced-batch.md).
- Materials are shared per color (`solid()`), so recoloring one block recolors all blocks of that color.
- Night changes go through shared materials rather than per-object edits ([pattern 008](../patterns/008-time-of-day.md)).

## Revisit when

- Objects need individual runtime changes (destructible or animated scenery): evaluate `BatchedMesh`.
- Draw calls stop being the bottleneck (profile first).
