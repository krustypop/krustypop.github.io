# 003 — Event bus

**Use when** a gameplay moment must trigger a reaction in another system (a sound, a UI effect, analytics).

**Why:** [ADR 0008](../adr/0008-layered-systems-event-bus.md).

## Rule

The system where the moment happens emits a `GameEvent`; systems that care subscribe. The emitter never knows who listens. Commands (open this sheet, mute) stay direct calls wired in `main.ts`; events are for "this happened".

## How

1. Add the name to `GameEvent` in `src/core/events.ts` (frozen object, `domain:verb`). Never emit a raw string.
2. Emit where it happens: `events.emit(GameEvent.JUMP)`, with a payload object when listeners need data: `events.emit(GameEvent.STEP, { surface, loudness })`.
3. Subscribe in the reacting system's factory: `events.on(GameEvent.STEP, handler)`. `on` returns an unsubscribe function.
4. For a new sound, adding the event to `EVENT_SOUNDS` in `src/audio/index.ts` is enough ([guide 004](../guides/004-audio.md)).

## Current events

`START` (Start pressed, inside the user gesture), `STEP`, `JUMP`, `LAND`, `TELEPORT`, `SIT`, `STAND`, `CURB`, `CROSS` (player; `CURB` at a crosswalk's curb facing the road, `CROSS` once the street is crossed curb to curb on the stripes), `NEAR` (a door came into reach), `OPEN`, `CLOSE` (sheets), `ACHIEVEMENT` (all experiences visited). `ARCADE_OPEN`, `ARCADE_START`, `ARCADE_SHOOT`, `ARCADE_HIT`, `ARCADE_HURT`, `ARCADE_MARCH` (beat index), `ARCADE_WAVE`, `ARCADE_BONUS`, `ARCADE_OVER` (the cabinet, [guide 005](../guides/005-arcade.md)).

## Pitfalls

- Dispatch is synchronous: `START` is emitted from the click/keydown handler, which is what lets audio create its `AudioContext` under the browser autoplay policy.
- Don't emit per frame; emit on transitions (`NEAR` fires when the target changes, not while it stays in reach).
