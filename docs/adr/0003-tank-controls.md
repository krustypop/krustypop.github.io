# 0003 — Tank controls with a trailing camera

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

Visitors are recruiters and peers, many of them not gamers, on a keyboard (AZERTY or QWERTY) or a phone. The avenue is a straight line; the goal is to walk to doors, not to explore freely.

## Options

- **Tank controls:** left/right turn the character, forward/back move along its heading; the camera trails behind. One hand, no mouse needed; maps directly to a joystick (x = turn, y = move).
- **Camera-relative movement with mouse orbit:** modern third-person feel, but needs two hands and pointer control, and is awkward on touch.

## Decision

Tank controls. Keys are read by physical position (`e.code`), so ZQSD and WASD are the same keys. The camera follows at a fixed offset with damped smoothing.

## Consequences

- `player/controller.ts` integrates heading + speed; `player/camera.ts` places the camera behind the heading and clamps it to the avenue so it never enters a building.
- Timeline jumps must set a heading as well as a position (`standHeading`) and snap the camera.
- Touch uses a virtual joystick with the same axes ([guide 002](../guides/002-input-routing.md)).

## Revisit when

- Playtests show visitors struggle to reach doors, or the world stops being a single straight avenue.
