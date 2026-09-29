# 005 — Arcade

**Use when** touching the arcade shop, its free cabinet, or “Bug Invaders”; or adding another playable game.

## How it fits

| File                     | Role                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `world/arcade.ts`        | the lot across from experience 4: walk-in bay, cabinets, neon; returns `{ object, update, arcade }` |
| `world/arcadeScreens.ts` | canvas textures: attract-mode sprite sheets, neon lettering, carpet                                 |
| `world/collision.ts`     | `addRoom()`: the bay is a room behind the facade the player may enter                               |
| `ui/arcadeGame.ts`       | pure game rules (tested in `tests/arcade.test.ts`)                                                  |
| `ui/arcadeDraw.ts`       | pixel-art renderer on a 160 × 144 canvas                                                            |
| `ui/arcade.ts`           | overlay shell: touch buttons, best score in storage, fx → `GameEvent.ARCADE_*`                      |
| `audio/sfx.ts`           | the `arcade*` sounds, mapped in `EVENT_SOUNDS`; music ducks between `ARCADE_OPEN` and `CLOSE`       |

1. **Station.** The lot returns `arcade: ArcadeStation` (`spot`, `heading`); `world.nearestArcade(pos, PLAYER.arcadeReach)` finds it. In `main.ts` it is the last candidate for the prompt (door, then bench, then arcade), and `interact()` calls `ui.openArcade()`.
2. **Overlay.** `#arcade` in `index.html` is a regular `.overlay`, so `ui.playing` is false and the hero stands still. `ui.arcadeOpen` tells `main.ts` to route keys to the game.
3. **Input.** Keys stay in `core/input.ts`: while `arcade.isActive()` held keys are still recorded, and `input.pad()` returns `{ left, right, fire }` merged with the overlay's touch buttons ([guide 002](002-input-routing.md)).
4. **Loop.** While the overlay is open, the main loop calls `ui.arcade.update(dt, input.pad())`: one `step`, events, one draw. No second `requestAnimationFrame`; the game allocates nothing per frame (pools, cached strings).
5. **Sound.** The core raises flags in `state.fx` for the last step; the shell turns them into events.

## The game

“Bug Invaders”: a formation of bugs marches down on a keyboard-cannon that fires semicolons. Bunkers (TypeScript blue) wear down; a React atom crosses the top now and then: hit it for 50–150 points and 8 s of coffee (three shots on screen, faster). One extra life at 1000. Each “sprint” (wave) starts lower and marches and bombs faster; clearing one pays `50 × wave`.

## Add a game

1. Write its rules as a pure factory next to `ui/arcadeGame.ts` (`step(dt, pad)`, `press()`, `title()`, `state.fx`) with tests.
2. Give it a renderer like `ui/arcadeDraw.ts`, then pick the game in `ui/arcade.ts` (one cabinet, one game; a second station means a second `ArcadeStation` and overlay mode).
3. Reuse the `ARCADE_*` events for sounds, or add new ones ([pattern 003](../patterns/003-event-bus.md)).
4. Decorative cabinets only need an attract sheet: add a drawer to `ATTRACT` in `world/arcadeScreens.ts` (four frames that loop) and a row to `HALL_GAMES`.

## Check

`/?debug`, then `cv.player.state.pos.set(12.3, 0.12, -153.35)` puts the hero at the cabinet (experience 4 at z = -158, lot on the +x side): the prompt reads “Play”. `cv.ui.openArcade()` opens it directly; `cv.ui.arcade.game.state` is the live game.

## Pitfalls

- The avenue camera never enters the bay (`world.clampCamera`): anything the player must see inside faces the avenue and stays under the ceiling's sightline (`CEIL`).
- Keep the bay clear of the lot's bench, flower beds and curb lamp: only the spawnward end of the facade (`DOOR`) is free.
- The pixel font lacks accented capitals: game text is plain uppercase.
