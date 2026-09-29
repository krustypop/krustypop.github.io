import * as THREE from 'three';
import { textTexture } from '../gfx/textures.ts';
import { type Layout, SIDEWALK_Y, WALK_HALF } from './layout.ts';
import type { CityMaterials } from './materials.ts';
import type { WorldExperience, XZ } from './types.ts';

const PAD_COLOR = '#ffe27a';
const CONTACT_COLOR = '#2f6fed';

type Pad = THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

/** A place the player can enter, clickable through `object`. */
export interface Target {
  type: 'experience' | 'contact';
  exp?: WorldExperience;
  object: THREE.Object3D;
  label: string;
  short: string;
  color: string;
  progress: number;
  door: XZ;
  stand: XZ;
  standHeading: number;
  pad: Pad;
}

function glowPad(scene: THREE.Object3D, [w, d]: [number, number], [x, y, z]: [number, number, number]): Pad {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.04, d),
    new THREE.MeshBasicMaterial({ color: PAD_COLOR, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  pad.position.set(x, y, z);
  scene.add(pad);
  return pad;
}

// Painted on the lane nearest the building, readable while walking toward -Z.
function yearMarking(scene: THREE.Object3D, mats: CityMaterials, year: string, side: number, z: number) {
  const texture = textTexture([year], { width: 512, height: 256, fg: 'rgba(255,255,255,0.85)', sizes: [110] });
  const material = mats.dimAtNight(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), material);
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(side * 3, 0.015, z);
  scene.add(mark);
}

/**
 * A place the player can enter. `door` is what proximity is measured against; `stand` and
 * `standHeading` are where a timeline jump drops the player, facing the door.
 */
export function experienceTarget(
  scene: THREE.Object3D,
  {
    exp,
    object,
    side,
    z,
    layout,
    mats,
  }: {
    exp: WorldExperience;
    object: THREE.Object3D;
    side: number;
    z: number;
    layout: Layout;
    mats: CityMaterials;
  },
): Target {
  yearMarking(scene, mats, exp.start, side, z);
  const target: Target = {
    type: 'experience',
    exp,
    object,
    label: exp.company,
    short: exp.start,
    color: exp.color,
    progress: layout.progressAt(z),
    door: { x: side * WALK_HALF, z },
    stand: { x: side * (WALK_HALF - 3), z },
    standHeading: (side * Math.PI) / 2,
    pad: glowPad(scene, [2.6, 3], [side * (WALK_HALF - 1.4), SIDEWALK_Y + 0.03, z]),
  };
  object.userData.target = target;
  return target;
}

export function contactTarget(
  scene: THREE.Object3D,
  { object, layout }: { object: THREE.Object3D; layout: Layout },
): Target {
  const z = layout.endZ;
  const target: Target = {
    type: 'contact',
    object,
    label: 'Contact',
    short: '@',
    color: CONTACT_COLOR,
    progress: 1,
    door: { x: 0, z },
    stand: { x: 0, z: z + 4 },
    standHeading: Math.PI,
    pad: glowPad(scene, [3, 2], [0, 0.03, z + 1.6]),
  };
  object.userData.target = target;
  return target;
}

// The pad of the target in reach pulses fast; the others breathe slowly, out of phase.
export function animatePads(targets: Target[], active: Target | null, t: number) {
  for (const target of targets) {
    target.pad.material.opacity =
      target === active ? 0.75 + Math.sin(t * 6) * 0.2 : 0.3 + Math.sin(t * 2 + target.progress * 10) * 0.12;
  }
}

export function nearestTarget<T>(
  targets: T[],
  { x, z }: XZ,
  reach: number,
  at: (t: T) => XZ = (t) => (t as { door: XZ }).door,
): T | null {
  let best: T | null = null;
  let bestDistance = reach;
  for (const target of targets) {
    const p = at(target);
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = target;
    }
  }
  return best;
}
