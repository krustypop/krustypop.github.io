# 002 — Dependency layers

**Use when** adding an `import`, a folder, or wiring two systems together.

**Why:** [ADR 0008](../adr/0008-layered-systems-event-bus.md).

## Rule

Imports only point downward:

```
main.ts
  → systems: world/  atmosphere/  player/  audio/  ui/
    → engine:  gfx/  core/        (+ config.ts, data.ts)
      → utils/
```

Systems never import each other. They meet in `main.ts`, which injects one into another or connects them through the event bus ([003](003-event-bus.md)).

## How

- Need something from another system? Take it as a factory argument ([001](001-factory-modules.md)). Example: the player needs the nearest target, so `world` exposes `nearestTarget(pos, reach)` and `createPlayer(world, events)` receives `world`.
- Need to tell others that something happened? Emit a `GameEvent`.
- Code used by several systems goes down a layer: rendering helpers to `gfx/`, browser plumbing to `core/`, pure helpers to `utils/`.
- `main.ts` holds wiring and the frame loop only ([guide 001](../guides/001-frame-loop.md)); no gameplay rules.

## Check

```bash
grep -rnE "from '\.\./(world|atmosphere|player|audio|ui)/" src/world src/atmosphere src/player src/audio src/ui
```

Any hit that crosses into a different system is a violation.
