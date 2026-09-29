import * as THREE from 'three';

const DRAG_TOLERANCE = 6; // px: beyond this a press is a drag, not a click

// Clicking or tapping an object whose ancestor carries `userData.target` selects that target.
export interface PickerOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  objects: THREE.Object3D[];
  isEnabled: () => boolean;
  onPick: (target: unknown) => void;
}

export function createPicker({ canvas, camera, objects, isEnabled, onPick }: PickerOptions) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pressed: { x: number; y: number } | null = null;
  let hover: { x: number; y: number } | null = null;

  function pick(x: number, y: number) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    let o: THREE.Object3D | null | undefined = raycaster.intersectObjects(objects, true)[0]?.object;
    while (o && !o.userData.target) o = o.parent;
    return o?.userData.target;
  }

  canvas.addEventListener('pointerdown', (e: PointerEvent) => (pressed = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const isClick = pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) <= DRAG_TOLERANCE;
    pressed = null;
    const target = isClick && isEnabled() ? pick(e.clientX, e.clientY) : null;
    if (target) onPick(target);
  });
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType === 'mouse') hover = { x: e.clientX, y: e.clientY };
  });

  return {
    // Hover raycasts at most once per frame instead of once per mouse event.
    update() {
      if (!hover) return;
      canvas.style.cursor = isEnabled() && pick(hover.x, hover.y) ? 'pointer' : '';
      hover = null;
    },
  };
}
