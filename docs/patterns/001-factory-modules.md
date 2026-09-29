# 001 — Factory modules

**Use when** adding a module that holds state or owns scene objects.

**Why:** [ADR 0009](../adr/0009-factory-functions.md).

## Rule

Every stateful unit is a `createX(deps)` function returning a plain object API. State lives in the closure; there are no classes, no `this`, no module-level mutable singletons.

```js
export function createClouds(scene, { rand, material, zMin, zMax }) {
  const clouds = []; // private state
  // …build once…
  return {
    update(dt) {
      /* per-frame work */
    },
  };
}
```

## How

- Take dependencies as arguments (`createPlayer(world, events)`), never by importing another system. See [002](002-dependency-layers.md).
- Construction does the one-off work (build meshes, attach listeners); the returned object only exposes what callers need: usually `update(dt, …)` plus a few commands.
- Methods reference closure variables, not `this`, so they can be passed around unbound (`onClock: atmosphere.skipToNextPhase`).
- Getters (`get started()`) expose read-only state.
- Pure helpers with no state stay plain exported functions (`clamp`, `nearestTarget`). See [004](004-pure-core.md).

## Pitfalls

- Module-level constants are fine (geometry, tuning, colors); module-level _mutable_ state is not, except when sharing is the point: the `solid()` material cache (`gfx/voxel.ts`), the fog `uniforms` every material reads ([ADR 0006](../adr/0006-height-fog-shader-chunk.md)), and scratch vectors/matrices reused within one call ([guide 001](../guides/001-frame-loop.md)).
- oxlint flags inner functions that capture nothing (`unicorn/consistent-function-scoping`): hoist them to module scope.

## Where

Every `create*` in `src/`: `world/index.ts`, `atmosphere/index.ts`, `player/controller.ts`, `audio/index.ts`, `ui/index.ts`, `core/*.ts`.
