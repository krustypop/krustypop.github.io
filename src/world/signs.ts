import * as THREE from 'three';
import { box } from '../gfx/voxel.ts';
import type { Colliders } from './collision.ts';
import { type Layout, SIDEWALK_Y } from './layout.ts';

const POLE = '#2d3036'; // same as the lamps: one draw call
const SIGN_BLUE = '#1f5fbf';
const ARROW = '#ffffff';
const SIGN_X = 6.45; // on the curb, clear of the lamps at 6.7
const SIGN_DZ = 2.4; // upstream of the stripes, before the lamp at +4
const POLE_HEIGHT = 2.3;
const BOARD = { w: 0.06, h: 0.5, d: 1.0 };
const ARROW_W = BOARD.w + 0.05; // pokes 0.025 out of both faces (z-fighting)

// Stepped voxel arrow pointing -Z, as [height, depth, z] blocks: shaft then head.
const ARROW_BLOCKS: [number, number, number][] = [
  [0.12, 0.5, 0.13],
  [0.36, 0.1, -0.17],
  [0.24, 0.1, -0.27],
  [0.12, 0.1, -0.37],
];

// French "sens unique": the board runs along the avenue so the arrow reads from the road, on both faces.
function oneWaySign(scene: THREE.Object3D, x: number, z: number) {
  const g = new THREE.Group();
  box(g, POLE, [0.1, POLE_HEIGHT, 0.1], [0, POLE_HEIGHT / 2, 0]);
  const y = POLE_HEIGHT + BOARD.h / 2 - 0.1;
  box(g, SIGN_BLUE, [BOARD.w, BOARD.h, BOARD.d], [0, y, 0]);
  for (const [h, d, bz] of ARROW_BLOCKS) box(g, ARROW, [ARROW_W, h, d], [0, y, bz], { shadow: false });
  g.position.set(x, SIDEWALK_Y, z);
  scene.add(g);
}

/** A one-way sign on each curb at every crosswalk: the owner's favourite quote, in street furniture. */
export function buildSigns(scene: THREE.Object3D, { layout, colliders }: { layout: Layout; colliders: Colliders }) {
  for (const c of layout.crosswalkZs) {
    for (const s of [-1, 1]) {
      oneWaySign(scene, s * SIGN_X, c + SIGN_DZ);
      colliders.add(s * SIGN_X, c + SIGN_DZ, 0.2);
    }
  }
}
