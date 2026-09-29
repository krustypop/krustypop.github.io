import * as THREE from 'three';
import { textTexture } from '../gfx/textures.ts';
import type { Emblem } from '../data.ts';
import { box, type Vec3 } from '../gfx/voxel.ts';

// A rooftop prop per job, built from blocks in the building's local space (facade toward +Z).

export const INK = '#1d1f24';
export const GOLD = '#f2c14e';
const GOLD_DARK = '#b98a1e';
export const PAPER = '#fdf7ea';

export function label(
  parent: THREE.Object3D,
  text: string,
  [w, h]: [number, number],
  [x, y, z]: Vec3,
  colors: [string, string],
) {
  const map = textTexture([text], {
    width: 256,
    height: Math.round((256 * h) / w),
    bg: colors[0],
    fg: colors[1],
    sizes: [96],
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
  plane.position.set(x, y, z);
  parent.add(plane);
  return plane;
}

// Rotating a block about an axis gives the diagonal that turns a square into an octagon.
export function rotatedBox(
  parent: THREE.Object3D,
  color: THREE.ColorRepresentation,
  size: Vec3,
  pos: Vec3,
  axis: 'y' | 'z',
) {
  const mesh = box(parent, color, size, pos);
  mesh.rotation[axis] = Math.PI / 4;
  return mesh;
}

const BUILDERS: Record<Emblem, (g: THREE.Group, accent: THREE.Color) => void> = {
  // Graduation cap: the school.
  cap(g) {
    box(g, INK, [1.6, 0.9, 1.6], [0, 0.45, 0]);
    box(g, INK, [3.4, 0.25, 3.4], [0, 1.0, 0]);
    box(g, '#c8503f', [0.16, 0.16, 1.5], [1.3, 0.75, 0]);
    box(g, GOLD, [0.36, 0.36, 0.36], [1.3, 0.35, 0.75]);
  },

  // Time sheets and leave management: a clock tower.
  clock(g) {
    box(g, '#6b6f78', [1.4, 2.4, 1.4], [0, 1.2, 0]);
    box(g, INK, [3.4, 3.4, 0.7], [0, 4.1, 0]);
    box(g, PAPER, [2.8, 2.8, 0.2], [0, 4.1, 0.4]);
    for (const [x, y] of [
      [0, 1.3],
      [0, -1.3],
      [1.3, 0],
      [-1.3, 0],
    ])
      box(g, INK, [0.2, 0.2, 0.1], [x, 4.1 + y, 0.55]);
    box(g, INK, [0.2, 1.0, 0.12], [0, 4.6, 0.6]); // hour
    box(g, '#c8503f', [1.2, 0.14, 0.12], [0.5, 4.1, 0.68]); // minute
  },

  // Flash sales: a shopping bag with a price tag.
  bag(g, accent) {
    box(g, accent, [2.8, 3.0, 1.4], [0, 1.5, 0]);
    box(g, PAPER, [2.8, 0.4, 1.42], [0, 2.4, 0]);
    box(g, INK, [0.2, 1.1, 0.2], [-0.7, 3.5, 0]);
    box(g, INK, [0.2, 1.1, 0.2], [0.7, 3.5, 0]);
    box(g, INK, [1.6, 0.2, 0.2], [0, 4.1, 0]);
    box(g, '#c8503f', [1.5, 0.9, 0.12], [0.6, 1.1, 0.76]);
    label(g, '-70%', [1.4, 0.7], [0.6, 1.1, 0.83], ['#c8503f', '#ffffff']);
  },

  // Property rentals: a little house and its key.
  house(g, accent) {
    box(g, PAPER, [2.6, 1.8, 2.4], [-0.6, 0.9, 0]);
    box(g, accent, [3.2, 0.5, 2.9], [-0.6, 2.05, 0]);
    box(g, accent, [2.4, 0.5, 2.7], [-0.6, 2.55, 0]);
    box(g, accent, [1.6, 0.5, 2.5], [-0.6, 3.05, 0]);
    box(g, accent, [0.8, 0.5, 2.3], [-0.6, 3.55, 0]);
    box(g, '#8a5a3a', [0.5, 1.2, 0.4], [-1.4, 3.6, -0.6]); // chimney
    box(g, '#3a2a22', [0.6, 1.0, 0.1], [-0.6, 0.5, 1.25]);
    box(g, GOLD, [0.5, 0.5, 0.2], [1.6, 3.2, 0.9]); // key bow
    box(g, INK, [0.2, 0.2, 0.22], [1.6, 3.2, 0.9]);
    box(g, GOLD, [0.2, 1.6, 0.2], [1.6, 2.2, 0.9]);
    box(g, GOLD, [0.5, 0.2, 0.2], [1.8, 1.6, 0.9]);
    box(g, GOLD, [0.35, 0.2, 0.2], [1.75, 2.0, 0.9]);
  },

  // The hotel-room "octagon" device: an octagonal pillar with a glowing top.
  octagon(g, accent) {
    for (const [size, y] of [
      [[2.6, 0.5, 2.6], 0.25],
      [[2.0, 3.4, 2.0], 2.2],
    ] satisfies [Vec3, number][]) {
      box(g, '#eceef4', size, [0, y, 0]);
      rotatedBox(g, '#eceef4', size, [0, y, 0], 'y');
    }
    box(g, accent, [1.2, 0.5, 1.2], [0, 4.15, 0]);
    rotatedBox(g, accent, [1.2, 0.5, 1.2], [0, 4.15, 0], 'y');
    label(g, 'ZZZ', [1.5, 0.75], [0, 2.4, 1.02], [INK, '#ffffff']);
  },

  // Crypto: a gold coin on a plinth.
  coin(g) {
    box(g, '#4a4f5c', [2.4, 0.6, 1.6], [0, 0.3, 0]);
    const y = 3.0;
    box(g, GOLD_DARK, [4.0, 2.4, 0.7], [0, y, 0]);
    box(g, GOLD_DARK, [2.4, 4.0, 0.7], [0, y, 0]);
    rotatedBox(g, GOLD_DARK, [2.9, 2.9, 0.7], [0, y, 0], 'z');
    box(g, GOLD, [3.4, 2.0, 0.8], [0, y, 0]);
    box(g, GOLD, [2.0, 3.4, 0.8], [0, y, 0]);
    rotatedBox(g, GOLD, [2.4, 2.4, 0.8], [0, y, 0], 'z');
    label(g, 'K', [1.4, 1.4], [0, y, 0.41], [GOLD, INK]);
  },

  // A hardware wallet standing on its USB plug.
  device(g) {
    box(g, '#8b8f99', [0.7, 0.9, 0.3], [0, 0.45, 0]);
    box(g, '#c9ccd4', [2.0, 4.6, 0.8], [0, 3.2, 0]);
    box(g, INK, [1.7, 4.3, 0.85], [0, 3.2, 0]);
    box(g, '#2a3b34', [1.3, 1.4, 0.1], [0, 4.2, 0.45]);
    label(g, 'OK', [1.1, 0.9], [0, 4.2, 0.51], ['#2a3b34', '#9dffc4']);
    box(g, '#c9ccd4', [0.45, 0.45, 0.1], [-0.4, 2.7, 0.45]);
    box(g, '#c9ccd4', [0.45, 0.45, 0.1], [0.4, 2.7, 0.45]);
  },
};

export function buildEmblem(parent: THREE.Object3D, emblem: Emblem, accent: THREE.Color) {
  const group = new THREE.Group();
  BUILDERS[emblem](group, accent);
  parent.add(group);
  return group;
}
