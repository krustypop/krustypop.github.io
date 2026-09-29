import * as THREE from 'three';
import { textTexture } from '../gfx/textures.ts';
import { box, coloredBlocks, type ColoredBlock, signBoard } from '../gfx/voxel.ts';
import { clamp, damp, lerp } from '../utils/math.ts';
import { pick, rng } from '../utils/random.ts';
import type { Colliders } from './collision.ts';
import { type GapSpot, WALK_HALF } from './layout.ts';
import type { CityMaterials } from './materials.ts';
import type { Rand, XZ } from './types.ts';

// Lot space: x along the avenue, the house on -Z, the gate at z = 0 on the facade line.
const SEED = 2023; // own stream, so the home never shifts the city
const LOT = { half: 9.6, depth: 17.5 }; // the gap between two facades is 21 wide
const PATH = { half: 0.9, walk: 1.1, length: 6.2 };
const PORCH = { front: 7, back: 9, half: 3.2, height: 0.6 };
const HOUSE = { half: 4.5, front: 9, back: 16, wall: 3 };
const TREE_CLEAR = 0.6; // park trunks stay this far outside the fence
const ROOF_STEPS = 5;
const WAVE_REACH = 12;
const WAVE_RATE = 5;
const FIGURE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

const LAWN = '#86c166';
const PICKET = '#f4efe4';
const STONES = ['#c9c2b4', '#bdb5a6', '#d6cfc1'];
const FLOWERS = ['#f28cb1', '#ffd23f', '#ffffff', '#b58cf2'];
const WALL = '#f3e3c3';
const TRIM = '#fbf8f1';
const ROOF = ['#b5533c', '#a84a35'];
const WOOD = '#b98a5e';
const DOOR = '#4f9d8f';
const SKIN = '#f6d7bf';
const HAIR = '#efcd72';
const DRESS = '#d9667f';
const BLANKET = '#f7e7a6';
const BLANKET_TRIM = '#fdf8ea';
const BABY_SKIN = '#f9dfcb';
const BABY_HAIR = '#e8c67a';
const CHEEK = '#f2a7a0';
const EYES = '#1b1b1b';

/** True where the home's lot lies, so park trees stay off it. */
export function onHomeLot({ side, z }: GapSpot, x: number, pz: number) {
  const u = side * x - WALK_HALF;
  return u > -1 && u < LOT.depth + TREE_CLEAR && Math.abs(pz - z) < LOT.half + TREE_CLEAR;
}

function fence(g: THREE.Object3D) {
  for (const s of [-1, 1]) {
    const [from, to] = [PATH.walk + 0.15, LOT.half];
    const mid = (s * (from + to)) / 2;
    for (const y of [0.35, 0.7]) box(g, PICKET, [to - from, 0.08, 0.05], [mid, y, -0.45], { shadow: false });
    for (let x = from; x <= to; x += 0.35) box(g, PICKET, [0.12, 0.85, 0.06], [s * x, 0.43, -0.4]);
    box(g, PICKET, [0.22, 1.05, 0.22], [s * (PATH.walk + 0.1), 0.53, -0.4]);
    // Post and rail down the sides, back to the house.
    for (const y of [0.4, 0.75]) box(g, PICKET, [0.06, 0.08, LOT.depth], [s * LOT.half, y, -0.4 - LOT.depth / 2]);
    for (let u = 0.4; u <= LOT.depth; u += 1.8) box(g, PICKET, [0.14, 0.9, 0.14], [s * LOT.half, 0.45, -u]);
  }
}

// Letterbox by the gate, marked with the year.
function mailbox(g: THREE.Object3D, year: number) {
  const x = PATH.walk + 0.9;
  box(g, '#2d3036', [0.12, 1.0, 0.12], [x, 0.5, -0.1]);
  box(g, '#c8503f', [0.42, 0.36, 0.56], [x, 1.18, -0.1]);
  const plate = signBoard(
    [0.36, 0.16, 0.03],
    textTexture([String(year)], { width: 192, height: 84, bg: TRIM, fg: '#1d1f24', sizes: [40] }),
    TRIM,
  );
  plate.position.set(x, 1.18, 0.2);
  g.add(plate);
}

function path(g: THREE.Object3D, rand: Rand) {
  for (let u = 0.2, row = 0; u < PATH.length - 0.3; u += 0.55, row++) {
    const shift = row % 2 ? 0.1 : -0.1;
    for (const s of [-1, 1]) {
      box(g, pick(rand, STONES), [0.84, 0.16, 0.48], [s * 0.44 + shift, 0.04, -u - 0.24], { shadow: false });
    }
  }
}

// Flowers and shrubs line both sides of the path.
function borders(g: THREE.Object3D, rand: Rand) {
  for (const s of [-1, 1]) {
    for (let u = 1; u < PATH.length - 0.4; u += 0.7) {
      const x = s * (PATH.walk + 0.35);
      if (Math.round(u / 0.7) % 3 === 0) {
        const w = 0.5 + rand() * 0.2;
        box(g, '#4f9a3a', [w, w, w], [x, w / 2, -u]);
        continue;
      }
      const h = 0.3 + rand() * 0.25;
      box(g, '#3f8a33', [0.05, h, 0.05], [x, h / 2, -u], { shadow: false });
      box(g, pick(rand, FLOWERS), [0.22, 0.18, 0.22], [x, h + 0.09, -u], { shadow: false });
    }
  }
}

function blossomTree(g: THREE.Object3D, rand: Rand, x: number, u: number, colors: string[]) {
  const trunk = 2 + rand() * 0.4;
  box(g, '#7a5230', [0.45, trunk, 0.45], [x, trunk / 2, -u]);
  box(g, colors[0], [2.4, 1.9, 2.4], [x, trunk + 0.75, -u]);
  box(g, colors[1], [1.5, 1.1, 1.5], [x + 0.2, trunk + 2.1, -u - 0.1]);
}

function stroller(g: THREE.Object3D, x: number, u: number) {
  const body = '#8fcfb8';
  for (const sx of [-0.32, 0.32])
    for (const du of [-0.3, 0.3]) box(g, '#2d3036', [0.08, 0.3, 0.3], [x + sx, 0.15, -u + du]);
  box(g, body, [0.62, 0.42, 0.85], [x, 0.55, -u]);
  box(g, body, [0.66, 0.36, 0.34], [x, 0.9, -u - 0.28]); // hood
  box(g, '#2d3036', [0.06, 0.55, 0.06], [x - 0.28, 0.9, -u + 0.5]);
  box(g, '#2d3036', [0.06, 0.55, 0.06], [x + 0.28, 0.9, -u + 0.5]);
  box(g, '#2d3036', [0.62, 0.07, 0.07], [x, 1.18, -u + 0.55]);
}

function porch(g: THREE.Object3D) {
  const depth = PORCH.back - PORCH.front;
  box(g, '#a77a52', [2.2, 0.2, 0.4], [0, 0.1, -PORCH.front + 0.6]);
  box(g, '#a77a52', [2.2, 0.4, 0.4], [0, 0.2, -PORCH.front + 0.2]);
  box(g, WOOD, [PORCH.half * 2, PORCH.height, depth], [0, PORCH.height / 2, -PORCH.front - depth / 2]);
  // Railing on both sides of the steps, a roof on two posts.
  for (const s of [-1, 1]) {
    const [from, to] = [1.1, PORCH.half - 0.1];
    box(g, TRIM, [to - from, 0.08, 0.08], [(s * (from + to)) / 2, PORCH.height + 0.75, -PORCH.front - 0.1]);
    for (let x = from; x <= to; x += 0.4)
      box(g, TRIM, [0.07, 0.75, 0.07], [s * x, PORCH.height + 0.37, -PORCH.front - 0.1]);
    box(
      g,
      TRIM,
      [0.2, HOUSE.wall - 0.2, 0.2],
      [s * (PORCH.half - 0.1), PORCH.height + (HOUSE.wall - 0.2) / 2, -PORCH.front - 0.1],
    );
  }
  box(
    g,
    ROOF[1],
    [PORCH.half * 2 + 0.4, 0.2, depth + 0.4],
    [0, PORCH.height + HOUSE.wall - 0.1, -PORCH.front - depth / 2],
  );
}

function house(g: THREE.Object3D, mats: CityMaterials) {
  const { half, front, back, wall } = HOUSE;
  const depth = back - front;
  const mid = -(front + back) / 2;
  const base = PORCH.height;
  const top = base + wall;
  box(g, '#9e9788', [half * 2 + 0.3, base, depth + 0.3], [0, base / 2, mid]);
  box(g, WALL, [half * 2, wall, depth], [0, base + wall / 2, mid]);
  for (let k = 0; k < ROOF_STEPS; k++) {
    const d = depth + 0.8 - k * 1.55;
    box(g, ROOF[k % 2], [half * 2 + 0.6, 0.45, d], [0, top + 0.22 + k * 0.45, mid]);
  }
  box(g, '#9c4a3a', [0.8, 2.4, 0.8], [2.8, top + 1.5, mid - 1.6]); // chimney

  // Door beside the mother, windows with shutters and flower boxes either side.
  const f = -front;
  box(g, TRIM, [1.4, 2.35, 0.12], [1.2, base + 1.17, f + 0.06]);
  box(g, DOOR, [1.1, 2.15, 0.14], [1.2, base + 1.07, f + 0.08]);
  box(g, '#e8c15a', [0.12, 0.12, 0.1], [1.6, base + 1.05, f + 0.17]);
  box(g, mats.lampBulb, [0.2, 0.3, 0.2], [2.25, base + 2.2, f + 0.12]);
  for (const x of [-2.9, 3.3]) {
    box(g, TRIM, [1.6, 1.3, 0.1], [x, base + 1.55, f + 0.04]);
    box(g, mats.windowLit, [1.3, 1.0, 0.1], [x, base + 1.55, f + 0.07]);
    for (const s of [-1, 1]) box(g, DOOR, [0.4, 1.2, 0.08], [x + s * 1.05, base + 1.55, f + 0.06]);
    box(g, WOOD, [1.4, 0.25, 0.3], [x, base + 0.8, f + 0.15]);
    [-0.45, 0, 0.45].forEach((dx, k) => box(g, FLOWERS[k], [0.26, 0.2, 0.2], [x + dx, base + 1.02, f + 0.15]));
  }
  for (const s of [-1, 1]) {
    box(g, TRIM, [0.1, 1.3, 1.6], [s * (half + 0.04), base + 1.55, mid]);
    box(g, mats.windowLit, [0.1, 1.0, 1.3], [s * (half + 0.07), base + 1.55, mid]);
  }
}

// A figure faces local +Z; limbs pivot at the shoulder or neck.
function limb(x: number, y: number, blocks: ColoredBlock[]) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const mesh = new THREE.Mesh(coloredBlocks(blocks), FIGURE);
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

// Blonde mother on the porch, the baby swaddled in her arms.
function family() {
  const root = new THREE.Group();
  const body = limb(0, 0, [
    [DRESS, [0.72, 0.9, 0.42], [0, 1.32, 0]],
    [DRESS, [0.86, 0.55, 0.54], [0, 0.72, 0]],
    [SKIN, [0.24, 0.5, 0.28], [-0.17, 0.25, 0]],
    [SKIN, [0.24, 0.5, 0.28], [0.17, 0.25, 0]],
    ['#f2f2f2', [0.26, 0.12, 0.38], [-0.17, 0.06, 0.04]],
    ['#f2f2f2', [0.26, 0.12, 0.38], [0.17, 0.06, 0.04]],
  ]);
  const head = limb(0, 1.78, [
    [SKIN, [0.64, 0.64, 0.64], [0, 0.32, 0]],
    [HAIR, [0.7, 0.2, 0.7], [0, 0.7, 0]],
    [HAIR, [0.7, 1.0, 0.18], [0, 0.3, -0.28]],
    [HAIR, [0.12, 0.75, 0.52], [-0.34, 0.35, -0.05]],
    [HAIR, [0.12, 0.75, 0.52], [0.34, 0.35, -0.05]],
    [HAIR, [0.46, 0.12, 0.1], [0, 0.6, 0.3]],
    [EYES, [0.09, 0.1, 0.04], [-0.14, 0.36, 0.33]],
    [EYES, [0.09, 0.1, 0.04], [0.14, 0.36, 0.33]],
    ['#b5463a', [0.16, 0.04, 0.03], [0, 0.17, 0.33]],
  ]);
  head.rotation.order = 'YXZ';
  // Shoulder and elbow pivots, so the forearms can cradle while the upper arms hang.
  const arms = [-0.48, 0.48].map((x) => {
    const shoulder = limb(x, 1.72, [
      [DRESS, [0.24, 0.26, 0.28], [0, -0.13, 0]],
      [SKIN, [0.2, 0.2, 0.24], [0, -0.34, 0]],
    ]);
    const elbow = limb(0, -0.44, [[SKIN, [0.2, 0.42, 0.22], [0, -0.19, 0]]]);
    elbow.rotation.order = 'YXZ';
    shoulder.add(elbow);
    return { shoulder, elbow };
  });
  // Swaddled and asleep across her forearms, head in the crook of her right elbow, face tipped up toward the street.
  const baby = limb(0, 1.54, [
    [BLANKET, [0.5, 0.3, 0.32], [0.08, 0, 0]],
    [BLANKET_TRIM, [0.5, 0.07, 0.34], [0.08, 0.1, 0]],
    [BLANKET, [0.14, 0.24, 0.26], [0.38, -0.01, 0]],
    [BLANKET, [0.38, 0.38, 0.34], [-0.33, 0.03, -0.03]], // hood
    [BABY_SKIN, [0.3, 0.29, 0.3], [-0.33, 0.02, 0.03]],
    [BABY_HAIR, [0.12, 0.05, 0.03], [-0.33, 0.14, 0.19]],
    [EYES, [0.08, 0.025, 0.02], [-0.4, 0.05, 0.185]],
    [EYES, [0.08, 0.025, 0.02], [-0.26, 0.05, 0.185]],
    [CHEEK, [0.06, 0.04, 0.02], [-0.44, -0.02, 0.185]],
    [CHEEK, [0.06, 0.04, 0.02], [-0.22, -0.02, 0.185]],
    ['#d9776f', [0.05, 0.03, 0.02], [-0.33, -0.07, 0.185]],
    [BABY_SKIN, [0.09, 0.08, 0.06], [-0.08, 0.15, 0.13]], // a hand out of the swaddle
  ]);
  baby.position.z = 0.5;
  baby.rotation.x = -0.35;
  body.add(head, ...arms.map((a) => a.shoulder), baby);
  root.add(body);
  root.userData.dynamic = true;
  return { root, body, head, arms, baby };
}

export interface Home {
  update: (dt: number, t: number, player: XZ) => void;
}

/** Scenery the player can walk up to: a gate, a garden path, and the family waiting on the porch. */
export function buildHome(
  scene: THREE.Object3D,
  spot: GapSpot,
  { mats, colliders, year }: { mats: CityMaterials; colliders: Colliders; year: number },
): Home {
  const { side, z } = spot;
  const rand = rng(SEED);
  const g = new THREE.Group();
  g.position.set(side * WALK_HALF, 0, z);
  g.rotation.y = (-side * Math.PI) / 2; // local +Z faces the avenue

  box(g, LAWN, [LOT.half * 2, 0.04, LOT.depth], [0, 0, -0.2 - LOT.depth / 2], { shadow: false });
  fence(g);
  mailbox(g, year);
  path(g, rand);
  borders(g, rand);
  blossomTree(g, rand, -5.8, 4.2, ['#f2b5c9', '#f7cfdb']);
  blossomTree(g, rand, 6.8, 12.5, ['#4f9a3a', '#5fae45']);
  stroller(g, 2.4, 5.4);
  porch(g);
  house(g, mats);

  const mother = family();
  mother.root.position.set(-1, PORCH.height, -PORCH.front - 0.9);
  g.add(mother.root);
  scene.add(g);

  const [u0, u1] = [WALK_HALF, WALK_HALF + PATH.length];
  colliders.addRoom({
    minX: side > 0 ? u0 : -u1,
    maxX: side > 0 ? u1 : -u0,
    minZ: z - PATH.walk,
    maxZ: z + PATH.walk,
  });

  const at = mother.root.getWorldPosition(new THREE.Vector3());
  const facing = g.rotation.y;
  let wave = 0;

  return {
    update(dt: number, t: number, player: XZ) {
      const [dx, dz] = [player.x - at.x, player.z - at.z];
      const near = Math.hypot(dx, dz) < WAVE_REACH;
      wave += ((near ? 1 : 0) - wave) * damp(WAVE_RATE, dt);

      const { body, head, arms, baby } = mother;
      const look = Math.atan2(Math.sin(Math.atan2(dx, dz) - facing), Math.cos(Math.atan2(dx, dz) - facing));
      head.rotation.y = lerp(0, clamp(look, -0.7, 0.7), wave);
      head.rotation.x = lerp(0.3, 0, wave); // eyes on the baby until someone comes by
      body.rotation.z = Math.sin(t * 1.4) * 0.04 * (1 - wave);
      baby.rotation.z = -0.15 + Math.sin(t * 1.4 + 0.5) * 0.07;
      arms[0].shoulder.rotation.set(-0.3, 0, 0.1);
      arms[0].elbow.rotation.set(-1.27, 0.55, 0);
      // The free arm leaves the baby to wave from the elbow.
      arms[1].shoulder.rotation.set(lerp(-0.3, 0, wave), 0, lerp(-0.1, 2.6, wave));
      arms[1].elbow.rotation.set(lerp(-1.27, -0.3, wave), lerp(-0.55, 0, wave), wave * Math.sin(t * 9) * 0.5);
    },
  };
}
