# 001 — Frame loop

**Use when** adding per-frame work, or anything called from `renderer.setAnimationLoop`.

## Rule

One loop, in `main.ts`, calling each system's `update` in a fixed order. Per-frame code allocates nothing and writes to the DOM or GPU only when a value changed.

## Order

1. `player.update(dt, input.movement())`, only once started
2. `hero.update(player.state, dt)`, then `followCamera.update(...)`
3. nearest target → emit `NEAR` on change
4. `env = atmosphere.update(...)`, then `world.update(..., env)`, `audio.setNight(env.night)`
5. `ui.update(...)`, `picker.update()`
6. `renderer.render(scene, camera)`

Insert new work where its inputs are ready (after the player moves, before render).

## How

- `dt` is clamped to `MAX_FRAME_DT` (`config.ts`): a long frame (tab switch) never teleports physics.
- Smooth with `damp(rate, dt)` (`utils/math.ts`), not a fixed lerp factor, so feel doesn't depend on frame rate.
- Preallocate scratch `Vector3`/`Color`/`Matrix4` at factory or module scope and reuse them (`intent` in `core/input.ts`, `forward` in the controller).
- Change-guard every per-frame write: `hud.setPrompt`/`setClock` compare with the last value, `timeline.setProgress` skips moves under 0.001, `setNight` uses an epsilon ([pattern 008](../patterns/008-time-of-day.md)).
- Expensive event-driven work is coalesced to once per frame (`picker.update()` raycasts the last hover, not every `pointermove`).

## Pitfalls

- The hidden Browser pane runs this loop at ~2 fps: judge behaviour from state (`/?debug` → `window.cv`), not from animation smoothness.
