# 004 — Pure core, thin shell

**Use when** writing logic: rules, math, timing, placement, parsing.

## Rule

Decisions live in pure modules (inputs → outputs, no DOM, no WebGL, no Web Audio). Systems are thin shells that feed them state and apply the results to meshes, DOM or audio nodes. Every pure module has tests in `tests/`, run by `bun test`.

| Pure module                          | Decides                                     | Tested in                  |
| ------------------------------------ | ------------------------------------------- | -------------------------- |
| `world/layout.ts`                    | where everything goes along the avenue      | `tests/world.test.ts`      |
| `world/collision.ts`                 | where the player may stand                  | `tests/world.test.ts`      |
| `world/eras.ts`                      | which architecture a year gets, its details | `tests/eras.test.ts`       |
| `world/targets.ts` (`nearestTarget`) | which door is in reach                      | `tests/world.test.ts`      |
| `world/life.ts`                      | passers-by, pigeons, cat, lights-out hours  | `tests/life.test.ts`       |
| `atmosphere/clock.ts`                | the hour, skipping, sun and moon directions | `tests/atmosphere.test.ts` |
| `atmosphere/palette.ts`              | colors and fog for an hour                  | `tests/atmosphere.test.ts` |
| `audio/song.ts`                      | notes, chords, pitch                        | `tests/music.test.ts`      |
| `audio/ambience.ts`                  | how loud a place is, when its next sound is | `tests/audio.test.ts`      |
| `player/controller.ts`               | sitting down and getting up                 | `tests/player.test.ts`     |
| `ui/arcadeGame.ts`                   | Bug Invaders: spawning, hits, lives, ramp   | `tests/arcade.test.ts`     |
| `player/poses.ts`                    | the hero's pose: walk, idle clips, dance    | `tests/character.test.ts`  |
| `core/events.ts`, `utils/*`          | plumbing                                    | `tests/core.test.ts`       |

## How

- Extract the rule into a function over plain values (`{ x, z }`, numbers, arrays). Three.js math types (`Vector3`, `Color`) are fine: `three` imports cleanly under Bun.
- Pass output containers in (`celestialDirections(hour, sun, moon)`, `samplePalette(hour, out)`) so the loop allocates nothing ([guide 001](../guides/001-frame-loop.md)).
- Test behaviour the player would notice ("a full day lasts 8 minutes", "skipping late at night wraps to dawn"), not internals.

## Pitfalls

- A module is only importable under Bun if nothing at import time touches `document`, `window` or WebGL. Keep such calls inside functions.
