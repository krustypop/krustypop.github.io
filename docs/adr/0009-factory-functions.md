# 0009 — Factory functions instead of classes

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

Each system needs private state, a few dependencies and a small public API (`update`, some commands). Methods are often passed around as callbacks (`onClock: atmosphere.skipToNextPhase`).

## Options

- **ES classes:** familiar, but methods lose `this` when passed as callbacks (binding boilerplate), and "private" needs `#fields`.
- **Factory functions (`createX(deps)` returning an object):** state is private by closure, methods can be passed unbound, and the API is exactly what is returned.

## Decision

Factory functions everywhere; no classes, no `this`.

## Consequences

- One shape across the codebase ([pattern 001](../patterns/001-factory-modules.md)).
- No `instanceof`, and no inheritance: composition only.
- oxlint's `consistent-function-scoping` rule catches inner helpers that should be hoisted out of the factory.

## Revisit when

- Thousands of short-lived instances are created per frame and profiling points at closure allocation.
