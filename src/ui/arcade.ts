import { type Emitter, GameEvent } from '../core/events.ts';
import { $, $$ } from '../utils/dom.ts';
import { readNumber, writeNumber } from '../utils/storage.ts';
import { createArcadeRenderer } from './arcadeDraw.ts';
import { createBugInvaders, type Pad } from './arcadeGame.ts';

const BEST_KEY = 'cv-avenue:arcade-best';
const RELEASE = ['pointerup', 'pointercancel', 'lostpointercapture'];

// Held while the finger is down: a click would only fire on release.
function holdButton(button: HTMLElement, buttons: Pad, key: keyof Pad) {
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    buttons[key] = true;
    button.setPointerCapture(e.pointerId);
  });
  for (const type of RELEASE) button.addEventListener(type, () => (buttons[key] = false));
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * The free cabinet's screen: runs “Bug Invaders” while its overlay is open.
 * Keys arrive through core/input.ts (`input.pad()`); `buttons` is the touch pad it merges in.
 */
export function createArcade({ root, events }: { root: HTMLElement; events: Emitter }) {
  const screen = $<HTMLCanvasElement>('canvas', root);
  const buttons: Pad = { left: false, right: false, fire: false };
  const game = createBugInvaders(Math.random, readNumber(BEST_KEY));
  const renderer = createArcadeRenderer(screen);
  const { fx } = game.state;
  for (const b of $$('[data-pad]', root)) holdButton(b, buttons, b.dataset.pad as keyof Pad);

  function emitFx() {
    if (fx.start) events.emit(GameEvent.ARCADE_START);
    if (fx.shoot) events.emit(GameEvent.ARCADE_SHOOT);
    if (fx.hit) events.emit(GameEvent.ARCADE_HIT);
    if (fx.hurt) events.emit(GameEvent.ARCADE_HURT);
    if (fx.march >= 0) events.emit(GameEvent.ARCADE_MARCH, fx.march);
    if (fx.wave) events.emit(GameEvent.ARCADE_WAVE);
    if (fx.bonus || fx.life) events.emit(GameEvent.ARCADE_BONUS);
    if (fx.over) {
      events.emit(GameEvent.ARCADE_OVER);
      writeNumber(BEST_KEY, game.state.best);
    }
  }

  return {
    buttons,
    /** Debug access to the running game (`?debug` → `cv.ui.arcade.game`). */
    game,

    open() {
      buttons.left = buttons.right = buttons.fire = false;
      game.title();
      renderer.draw(game.state);
      screen.focus({ preventScroll: true }); // off the close button, so Space never presses it
    },

    // E / Enter, between frames: only the start can come of it.
    press() {
      if (game.press()) events.emit(GameEvent.ARCADE_START);
    },

    update(dt: number, pad: Pad) {
      game.step(dt, pad);
      emitFx();
      renderer.draw(game.state);
    },
  };
}

export type Arcade = ReturnType<typeof createArcade>;
