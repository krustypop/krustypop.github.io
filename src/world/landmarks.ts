import * as THREE from 'three';
import { textTexture } from '../gfx/textures.ts';
import { box, hitbox, signBoard } from '../gfx/voxel.ts';
import type { Colliders } from './collision.ts';
import type { Layout } from './layout.ts';
import type { WorldProfile } from './types.ts';

const DARK = '#1d1f24';
const PAPER = '#fdf7ea';
const MAILBOX_BLUE = '#2f6fed';

/** Name banner the player walks under at spawn. */
export function buildArch(scene: THREE.Object3D, layout: Layout, profile: WorldProfile, colliders: Colliders) {
  const z = layout.archZ;
  for (const s of [-1, 1]) {
    box(scene, DARK, [1, 8, 1], [s * 8, 4, z]);
    box(scene, '#ffd24a', [1.4, 0.5, 1.4], [s * 8, 8.2, z]);
    colliders.add(s * 8, z, 0.8);
  }
  box(scene, DARK, [17, 2.6, 0.4], [0, 6.8, z]);
  const texture = textTexture([profile.name.toUpperCase(), profile.title], {
    width: 1456,
    height: 205,
    bg: DARK,
    fg: '#ffd24a',
    sizes: [64, 30],
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 2.2), new THREE.MeshBasicMaterial({ map: texture }));
  banner.position.set(0, 6.8, z + 0.21);
  scene.add(banner);
}

/** Paved square at the end of the avenue; returns the clickable mailbox. */
export function buildContactPlaza(
  scene: THREE.Object3D,
  layout: Layout,
  profile: WorldProfile,
  colliders: Colliders,
): THREE.Group {
  const z = layout.endZ;
  box(scene, '#d9cfbf', [20, 0.02, layout.plaza.depth], [0, 0.01, layout.plaza.midZ], { shadow: false });

  const mailbox = new THREE.Group();
  box(mailbox, '#2d3036', [0.2, 0.7, 0.2], [0, 0.35, 0]);
  box(mailbox, MAILBOX_BLUE, [0.9, 1.1, 0.7], [0, 1.25, 0]);
  box(mailbox, '#1f4fb8', [0.96, 0.2, 0.76], [0, 1.9, 0]);
  box(mailbox, '#15171d', [0.5, 0.08, 0.05], [0, 1.5, 0.36]);
  hitbox(mailbox, [1, 2, 0.8], [0, 1, 0]);
  mailbox.position.set(0, 0, z);
  scene.add(mailbox);
  colliders.add(0, z, 0.6);

  const boardZ = z - 10;
  for (const s of [-1, 1]) box(scene, DARK, [0.4, 6, 0.4], [s * 5, 3, boardZ]);
  const texture = textTexture(['CONTACT', profile.contact.message], {
    width: 1024,
    height: 384,
    bg: PAPER,
    fg: DARK,
    sizes: [80, 26],
    border: MAILBOX_BLUE,
  });
  const board = signBoard([11, 4, 0.3], texture, DARK);
  board.position.set(0, 5.5, boardZ);
  scene.add(board);

  return mailbox;
}
