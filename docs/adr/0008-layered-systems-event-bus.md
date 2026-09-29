# 0008 — Layered systems connected by injection and an event bus

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

The prototype grew into five large files (`world.js` had 612 lines) where UI, audio and gameplay called each other directly. That coupling caused a real bug: the UI and the game both listened to `keydown`, so E closed a sheet and reopened it in the same keypress.

## Options

- **Keep direct calls between modules:** least code, but every new feature touches several systems.
- **Full ECS or a framework:** strong structure, heavy for a small game.
- **Layered folders + dependency injection for commands + an event bus for notifications.**

## Decision

Folders form layers that import only downward: `main` → systems (`world`, `atmosphere`, `player`, `audio`, `ui`) → `gfx`, `core` → `utils`. Systems never import each other. `main.ts` wires them: commands go through injected dependencies and callbacks, and "this happened" goes through `GameEvent`s on one emitter. Keyboard input has a single entry point.

## Consequences

- Rules: [pattern 002](../patterns/002-dependency-layers.md) (layers, with a grep check), [pattern 003](../patterns/003-event-bus.md) (events), [guide 002](../guides/002-input-routing.md) (input).
- Audio is a pure listener, and new reactions don't touch the emitter.
- `main.ts` is the one place that knows everything; it must stay wiring only ([guide 001](../guides/001-frame-loop.md)).
- A bit more indirection: finding who reacts to an event means searching for `GameEvent.X`.

## Revisit when

- Many entities with shared behaviours appear (NPCs, vehicles): an ECS could then pay for itself.
