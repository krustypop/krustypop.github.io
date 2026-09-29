# 002 — Input routing

**Use when** adding a key binding, a button, or touch control.

**Why:** tank controls: [ADR 0003](../adr/0003-tank-controls.md); single entry point: [ADR 0008](../adr/0008-layered-systems-event-bus.md).

## Rule

Keyboard input has a single entry point, `core/input.ts`: held keys become a movement `intent`, bound keys become named actions. `main.ts` routes each action by UI state. No other module listens to `keydown` for gameplay.

The one exception is the start screen's "press any key" listener in `ui/index.ts`, which returns early once started.

## How

- New key: add it to `ACTIONS` in `core/input.ts` (`KeyX: 'actionName'`, using `e.code`, so AZERTY and QWERTY share physical keys), then handle `'actionName'` in the `input.onAction` router in `main.ts`, in the right state branch:
  - `sound` / `music` (M / B): any time after start;
  - arcade open (`ui.arcadeOpen`): `back` closes it, `interact` starts / restarts the game;
  - other overlay open: `back` / `interact` close it;
  - playing: gameplay actions. `interact` (E, or the prompt button) stands up when seated, else enters the door in reach, else sits on the bench in reach, else opens the arcade cabinet in reach; any movement also stands up (`player.update`).
- New movement key: extend a `KEYS` group. `MOVE_KEYS` (keys whose browser default, like scrolling, is prevented) is derived from those groups; add a new group to it.
- New HUD button: bind it with `onPress(button, handler)` from `utils/dom.ts` (it blurs afterwards so Space/Enter go back to the game) and pass the handler in from `main.ts`.
- Touch: the joystick (`ui/joystick.ts`) is a live `{ x, y }` read by `input.movement()`; tapping the 3D scene goes through `core/picker.ts`.
- Arcade: while `arcade.isActive()` (`ui.arcadeOpen`), held keys are recorded even though movement is disabled, and `input.pad()` returns `{ left, right, fire }` (arrows / QD, Space or up / Z) merged with the overlay's hold buttons (`arcade.buttons`, pointer events since a click only fires on release). `main.ts` feeds it to `ui.arcade.update` each frame ([guide 005](005-arcade.md)).

## Pitfalls

- A second `keydown` listener reintroduces a fixed bug: the UI closed a sheet on E, then the game listener reopened it in the same keypress.
- Movement is gated by `isEnabled` (`ui.playing`); actions are not, so the router must check state itself.
- An overlay focuses its close button; the arcade moves focus to its canvas, or Space would press ✕.
