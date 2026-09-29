# 007 — Seeded procedural generation

**Use when** placing or varying anything randomly (trees, colors, floors, lit windows).

**Why:** [ADR 0004](../adr/0004-reproducible-city.md).

## Rule

Randomness is deterministic: the city must look identical on every visit and every reload. Use `rng(seed)` from `utils/random.ts` (Mulberry32), never `Math.random()`, in world generation.

## Streams

| Stream                  | Seed                     | Consumed by                                             |
| ----------------------- | ------------------------ | ------------------------------------------------------- |
| Experience building _i_ | `rng(i * 7919 + 1)`      | its windows, then its rooftop units                     |
| Filler building _i_     | `rng(i * 104729 + 7)`    | color, floor count, windows, rooftop units              |
| City                    | `rng(CITY_SEED)` (42)    | furniture (street trees, park, tree walls), then clouds |
| Pedestrians             | `rng(5147)`, `rng(5148)` | outfits and start spots; then bench dice, sit times     |
| Pigeons                 | `rng(7331)`, `rng(7332)` | flocks and start spots; then landing spots, flights     |
| Lit window              | hash of its position     | lights-out and dawn hours, silhouette                   |

## How

- Pick from a list with `pick(rand, items)`.
- Give a new independent element its own stream (seeded by index) so adding it does not shift anything else.
- Pass `rand` down explicitly; never share a stream through module state.

## Pitfalls

- Order matters: inserting, removing or reordering a `rand()` call reshuffles everything drawn after it on that stream. When refactoring, keep call order (argument evaluation order counts).
- Adding an experience in `data.ts` legitimately adds buildings; it must not reshuffle existing ones (per-index streams guarantee it).
- Audio may use `Math.random()` (footstep pitch, noise offset): it is not world generation.
