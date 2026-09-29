# 0004 — Reproducible, seeded city

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

The city is generated (tree placement, filler colors, lit windows, clouds). A CV is shared by link: two people discussing it, or the owner checking a screenshot, should see the same street.

## Options

- **`Math.random()`:** a different city on each load. Livelier, but unpredictable visuals, flaky screenshots, and bugs that can't be reproduced.
- **Seeded PRNG:** identical city on every load; variety only changes when the code or the data does.

## Decision

Seeded Mulberry32 (`utils/random.ts`), with one stream per building and one for the city.

## Consequences

- Visual regressions can be checked by comparing screenshots at a fixed position and hour.
- Generation code is order-sensitive: moving a `rand()` call reshuffles everything drawn after it on that stream ([pattern 007](../patterns/007-seeded-generation.md)).

## Revisit when

- Variety between visits becomes a goal (e.g. seasonal decorations), which could use a date-based seed rather than dropping determinism.
