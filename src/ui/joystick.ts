const KNOB_TRAVEL = 0.55; // of the pad radius

/** Virtual stick for touch screens. The returned `{ x, y }` is live, each in [-1, 1] (y down). */
export function createJoystick(pad: HTMLElement) {
  const knob = pad.querySelector<HTMLElement>('.knob')!;
  const stick = { x: 0, y: 0 };
  let pointer: number | null = null;

  function move(e: PointerEvent) {
    const r = pad.getBoundingClientRect();
    const radius = r.width / 2;
    let x = (e.clientX - r.left - radius) / radius;
    let y = (e.clientY - r.top - radius) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    stick.x = x;
    stick.y = y;
    const travel = radius * KNOB_TRAVEL;
    knob.style.transform = `translate(calc(-50% + ${x * travel}px), calc(-50% + ${y * travel}px))`;
  }

  function release(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    pointer = null;
    stick.x = stick.y = 0;
    knob.style.transform = '';
  }

  pad.addEventListener('pointerdown', (e) => {
    pointer = e.pointerId;
    pad.setPointerCapture(pointer);
    move(e);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === pointer && move(e));
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  return stick;
}
