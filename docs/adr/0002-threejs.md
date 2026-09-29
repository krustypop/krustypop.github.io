# 0002 — Three.js as the 3D engine

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

A browser-first, voxel-style third-person scene with a handful of interactions, meant to load fast on desktop and phones. It is a CV: most visitors spend a minute in it.

## Options

- **Three.js:** small, low-level, huge ecosystem; you build game structure (loop, input, physics) yourself.
- **Babylon.js / PlayCanvas:** more engine features built in (physics, inspector, scene editor); heavier and more opinionated.
- **Game-engine export (Unity / Godot to WebGL):** full engine, but multi-megabyte payloads, slow start, weak mobile support.

## Decision

Three.js, with the game structure written by hand and kept minimal.

## Consequences

- Loop, input, collisions and camera are ours (`main.ts`, `core/`, `player/`, `world/collision.ts`), so they stay tiny and specific: circle obstacles in a strip, no physics engine.
- Visual effects hook into three's internals when needed ([ADR 0006](0006-height-fog-shader-chunk.md)), which ties us to three's shader chunk names across upgrades.

## Revisit when

- The game needs real physics, complex animation or a level editor.
