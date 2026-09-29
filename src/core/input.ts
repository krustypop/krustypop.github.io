import { clamp1 } from '../utils/math.ts';

// e.code is the physical key, so ZQSD on AZERTY and WASD on QWERTY are the same codes.
const KEYS: Record<'forward' | 'back' | 'left' | 'right' | 'run' | 'jump', string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
};
const MOVE_KEYS = new Set([...KEYS.forward, ...KEYS.back, ...KEYS.left, ...KEYS.right, ...KEYS.jump]);
export type InputAction = 'interact' | 'time' | 'sound' | 'music' | 'back';
export interface Intent {
  forward: number;
  turn: number;
  run: boolean;
  jump: boolean;
}
export interface Pad {
  left: boolean;
  right: boolean;
  fire: boolean;
}
export interface InputOptions {
  joystick: { x: number; y: number };
  isEnabled: () => boolean;
  // While `isActive`, held keys (and these touch buttons) steer the arcade game instead of the hero.
  arcade?: { buttons: Pad; isActive: () => boolean };
}

const ACTIONS: Record<string, InputAction> = {
  KeyE: 'interact',
  Enter: 'interact',
  KeyN: 'time',
  KeyM: 'sound',
  KeyB: 'music',
  Escape: 'back',
};
const JOYSTICK_RUN = 0.92;

/**
 * Single keyboard entry point: held keys drive movement, bound keys fire actions.
 * `isEnabled` gates movement only; actions always fire so the caller can route them by game state.
 */
export function createInput({ joystick, isEnabled, arcade }: InputOptions) {
  const held = new Set();
  const intent: Intent = { forward: 0, turn: 0, run: false, jump: false };
  const pad: Pad = { left: false, right: false, fire: false };
  let onAction: ((action: InputAction) => void) | null = null;

  const pressed = (codes: string[]) => codes.some((code) => held.has(code));
  const axis = (pos: string[], neg: string[]) => (pressed(pos) ? 1 : 0) - (pressed(neg) ? 1 : 0);

  addEventListener('keydown', (e: KeyboardEvent) => {
    const action = ACTIONS[e.code];
    if (action && !e.repeat) onAction?.(action);
    if (!isEnabled() && !arcade?.isActive()) return;
    if (MOVE_KEYS.has(e.code)) e.preventDefault();
    held.add(e.code);
  });
  addEventListener('keyup', (e: KeyboardEvent) => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  return {
    onAction(handler: (action: InputAction) => void) {
      onAction = handler;
    },

    movement() {
      const enabled = isEnabled();
      const { x, y } = enabled ? joystick : { x: 0, y: 0 };
      intent.forward = enabled ? clamp1(axis(KEYS.forward, KEYS.back) - y) : 0;
      intent.turn = enabled ? clamp1(axis(KEYS.left, KEYS.right) - x) : 0;
      intent.run = enabled && (pressed(KEYS.run) || Math.hypot(x, y) > JOYSTICK_RUN);
      intent.jump = enabled && pressed(KEYS.jump);
      return intent;
    },

    // Arcade controls: arrows / AD move, Space or up / W fires; merged with the touch buttons.
    pad() {
      const buttons = arcade?.buttons;
      pad.left = pressed(KEYS.left) || !!buttons?.left;
      pad.right = pressed(KEYS.right) || !!buttons?.right;
      pad.fire = pressed(KEYS.jump) || pressed(KEYS.forward) || !!buttons?.fire;
      return pad;
    },
  };
}
