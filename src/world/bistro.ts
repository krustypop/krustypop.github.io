import * as THREE from 'three';
import { radialTexture, textTexture } from '../gfx/textures.ts';
import { box, type Vec3 } from '../gfx/voxel.ts';
import { rng } from '../utils/random.ts';
import { type BuildingDeps, placeFacingAvenue } from './buildings.ts';
import { label } from './emblems.ts';
import { BUILDING, SIDEWALK_Y, WALK_HALF } from './layout.ts';
import type { Lot, WorldEnv } from './lots.ts';
import type { XZ } from './types.ts';

/** A terrace prop: `dz` along the avenue from the lot's center (spawnward +), `d` out from the facade. */
export interface TerracePiece {
  kind: 'table' | 'post' | 'pot' | 'easel';
  dz: number;
  d: number;
  r: number;
}

// Spawnward of the bench and its flower beds (dz ≤ 3), off the curb lamp at dz 4; spills past the building end.
export const TERRACE: readonly TerracePiece[] = [
  { kind: 'table', dz: 4.6, d: 1.3, r: 1.0 }, // r covers its two chairs
  { kind: 'table', dz: 7.9, d: 1.3, r: 1.0 },
  { kind: 'post', dz: 9.6, d: 2.5, r: 0.15 },
  { kind: 'post', dz: 9.6, d: 0.3, r: 0.15 },
  { kind: 'pot', dz: 9.6, d: 1.4, r: 0.35 },
  { kind: 'pot', dz: 5.6, d: 0.35, r: 0.35 },
  { kind: 'pot', dz: -5.9, d: 0.4, r: 0.35 },
  { kind: 'easel', dz: 10.6, d: 1.9, r: 0.45 }, // first thing met coming from the spawn
];
export const CHAIR_OFFSET = 0.72; // along the avenue, either side of a table

export const lotToWorld = (side: number, z: number, dz: number, d: number): XZ => ({
  x: side * (WALK_HALF - d),
  z: z + dz,
});

const BISTRO_SEED = 1664; // own stream: the filler it replaces keeps its stream untouched
const FLOORS = 2;
const STONE = '#e6d2a6';
const TRIM = new THREE.Color('#c4ad80');
const GREEN = '#2f4b3c';
const WOOD = '#6b4428';
const GOLD = '#e2b64c';
const ZINC = '#7d8994';
const TERRACOTTA = '#b85a3c';
const AWNING = ['#8e2a2e', '#f1e6cf'];
const MARBLE = '#ece7dc';
const IRON = '#2d3036';
const RATTAN = '#c99a5b';
const WINE = '#7a1f2b';
const BOTTLE = '#1f4a2c';
const GERANIUM = '#d63a3a';
const LEAF = '#4f9a3a';
const DARK_GLASS = '#2b3440';
const CHALK = ['#26332c', '#f4f1e8'];
const BULB: [THREE.Color, THREE.Color] = [new THREE.Color('#bdb5a2'), new THREE.Color('#ffd27a')];
const BULB_SPACING = 0.5;
const GLOW_OPACITY = 0.4;
const NIGHT_EPSILON = 0.001;
const AWNING_TILT = 0.35;
const Y = SIDEWALK_Y;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Thin rotated block from a to b, for wires.
function segment(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = b.clone().sub(a);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const m = box(parent, IRON, [0.03, 0.03, dir.length()], [mid.x, mid.y, mid.z], { shadow: false });
  m.quaternion.setFromUnitVectors(Z_AXIS, dir.normalize());
}

// A sagging wire of bulbs between two hooks.
function strand(parent: THREE.Object3D, bulb: THREE.Material, a: Vec3, b: Vec3, sag: number) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const n = Math.max(2, Math.round(A.distanceTo(B) / BULB_SPACING));
  let prev = A;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const p = A.clone().lerp(B, t);
    p.y -= sag * 4 * t * (1 - t);
    segment(parent, prev, p);
    if (k < n) box(parent, bulb, [0.1, 0.13, 0.1], [p.x, p.y - 0.09, p.z], { shadow: false });
    prev = p;
  }
}

function body(g: THREE.Group, deps: BuildingDeps) {
  const { width: W, depth: D, groundFloor, floor } = BUILDING;
  const H = groundFloor + FLOORS * floor;
  const F = D / 2;
  box(g, STONE, [W, H, D], [0, H / 2, 0]);
  box(g, TRIM, [W + 0.3, 0.5, D + 0.3], [0, 0.25, 0]);
  box(g, TRIM, [W + 0.4, 0.35, D + 0.4], [0, groundFloor, 0]);
  box(g, TRIM, [W + 0.6, 0.6, D + 0.6], [0, H + 0.3, 0]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(g, TRIM, [0.7, H, 0.7], [(sx * W) / 2, H / 2, sz * F]);
  }
  deps.windows.addBuilding(g.matrix, FLOORS, TRIM, rng(BISTRO_SEED));

  // Geraniums on the first-floor sills (same slots as windows.ts).
  const sillY = groundFloor + floor * 0.55 - 0.98;
  for (let c = 0; c < 4; c++) {
    const x = -W / 2 + ((c + 0.5) * W) / 4;
    box(g, WOOD, [1.5, 0.22, 0.26], [x, sillY + 0.19, F + 0.3]);
    for (let k = 0; k < 4; k++) {
      box(g, LEAF, [0.26, 0.14, 0.2], [x - 0.54 + k * 0.36, sillY + 0.37, F + 0.3], { shadow: false });
      box(g, GERANIUM, [0.16, 0.14, 0.16], [x - 0.54 + k * 0.36, sillY + 0.5, F + 0.3], { shadow: false });
    }
  }

  // Stepped zinc mansard with dormers and chimneys: a Paris roofline.
  const R = H + 0.6;
  box(g, ZINC, [W - 0.4, 1.0, D - 0.4], [0, R + 0.5, 0]);
  box(g, ZINC, [W - 1.8, 0.9, D - 1.8], [0, R + 1.45, 0]);
  for (const x of [-3.5, 0, 3.5]) {
    box(g, STONE, [1.2, 1.3, 0.6], [x, R + 0.65, F - 0.5]);
    box(g, DARK_GLASS, [0.7, 0.8, 0.05], [x, R + 0.6, F - 0.18]);
    box(g, ZINC, [1.4, 0.2, 0.8], [x, R + 1.4, F - 0.5]);
  }
  for (const x of [-4.6, 4.6]) {
    box(g, STONE, [0.8, 1.6, 0.6], [x, R + 2.3, -2]);
    for (const dx of [-0.2, 0.2]) box(g, TERRACOTTA, [0.2, 0.35, 0.2], [x + dx, R + 3.27, -2]);
  }
}

function shopfront(g: THREE.Group, side: number, glass: THREE.Material) {
  const F = BUILDING.depth / 2;
  box(g, GREEN, [12.3, 4.1, 0.25], [0, 2.55, F + 0.125]);

  for (const [sx, text] of [
    [-1, 'BISTROT'],
    [1, 'CAVE'],
  ] as const) {
    const x = sx * 3.6;
    box(g, WOOD, [4.2, 0.1, 0.35], [x, 0.8, F + 0.3]);
    box(g, WOOD, [4.0, 2.6, 0.05], [x, 2.1, F + 0.27]);
    box(g, glass, [3.8, 2.4, 0.06], [x, 2.1, F + 0.3]);
    for (const bx of [-1.95, 1.95]) box(g, WOOD, [0.14, 2.6, 0.1], [x + bx, 2.1, F + 0.33]);
    for (const by of [0.85, 2.75, 3.35]) box(g, WOOD, [4.0, 0.12, 0.1], [x, by, F + 0.33]);
    for (const bx of [-0.65, 0.65]) box(g, WOOD, [0.08, 0.6, 0.1], [x + bx, 3.05, F + 0.33]);
    label(g, text, [2.2, 0.42], [x, 1.5, F + 0.35], [GREEN, GOLD]);
  }

  box(g, WOOD, [1.5, 2.9, 0.14], [0, 1.45, F + 0.3]);
  box(g, glass, [1.0, 1.3, 0.04], [0, 2.05, F + 0.39]);
  box(g, GOLD, [0.14, 0.14, 0.1], [0.5, 1.35, F + 0.4]);

  // Name board between the awning and the string course.
  box(g, GOLD, [7.8, 0.9, 0.06], [0, 4.1, F + 0.27]);
  const face = textTexture(['AU BON COMMIT', 'bistrot - cave à vins'], {
    width: 1024,
    height: 112,
    bg: GREEN,
    fg: GOLD,
    sizes: [48, 22],
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 0.8), new THREE.MeshBasicMaterial({ map: face }));
  sign.position.set(0, 4.1, F + 0.33);
  g.add(sign);

  // Striped awning sloping down over the windows and the bench.
  const awning = new THREE.Group();
  awning.position.set(0, 3.55, F + 0.25);
  awning.rotation.x = AWNING_TILT; // positive: tips local +Z (outward) down
  const stripes = 12;
  const w = 11.6 / stripes;
  for (let k = 0; k < stripes; k++) {
    const x = -5.8 + w * (k + 0.5);
    box(awning, AWNING[k % 2], [w, 0.08, 1.6], [x, 0, 0.8]);
    box(awning, AWNING[k % 2], [w, 0.3, 0.06], [x, -0.15, 1.6]);
  }
  g.add(awning);

  // Blade sign between the last window and the corner pillar, so it reads down the avenue.
  const bx = side * 5.95;
  box(g, GOLD, [0.1, 0.8, 1.1], [bx, 5.45, F + 0.9]);
  box(g, IRON, [0.08, 0.08, 1.4], [bx, 5.95, F + 0.7]);
  const blade = new THREE.MeshBasicMaterial({
    map: textTexture(['VINS'], { width: 256, height: 180, bg: AWNING[0], fg: AWNING[1], sizes: [72] }),
  });
  for (const s of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), blade);
    plane.position.set(bx + s * 0.075, 5.45, F + 0.9);
    plane.rotation.y = (s * Math.PI) / 2;
    g.add(plane);
  }
}

// Sitter faces local +Z.
function chair(g: THREE.Object3D, x: number, z: number, yaw: number) {
  const c = new THREE.Group();
  box(c, RATTAN, [0.44, 0.06, 0.44], [0, 0.46, 0]);
  for (const sx of [-0.17, 0.17]) {
    for (const sz of [-0.17, 0.17]) box(c, IRON, [0.05, 0.43, 0.05], [sx, 0.215, sz], { shadow: false });
    box(c, IRON, [0.05, 0.5, 0.05], [sx, 0.74, -0.17], { shadow: false });
  }
  box(c, RATTAN, [0.36, 0.2, 0.04], [0, 0.86, -0.2]);
  c.position.set(x, Y, z);
  c.rotation.y = yaw;
  g.add(c);
}

// Round-ish marble top on a cast-iron foot.
function table(g: THREE.Object3D, x: number, z: number) {
  box(g, IRON, [0.5, 0.05, 0.12], [x, Y + 0.025, z]);
  box(g, IRON, [0.12, 0.05, 0.5], [x, Y + 0.025, z]);
  box(g, IRON, [0.08, 0.7, 0.08], [x, Y + 0.4, z]);
  box(g, MARBLE, [0.8, 0.05, 0.56], [x, Y + 0.77, z]);
  box(g, MARBLE, [0.56, 0.05, 0.8], [x, Y + 0.77, z]);
}

const TABLE_TOP = Y + 0.795;

function wineGlass(g: THREE.Object3D, x: number, z: number) {
  box(g, '#dfe8ea', [0.03, 0.1, 0.03], [x, TABLE_TOP + 0.05, z], { shadow: false });
  box(g, WINE, [0.08, 0.08, 0.08], [x, TABLE_TOP + 0.14, z], { shadow: false });
}

function pot(g: THREE.Object3D, x: number, z: number) {
  box(g, TERRACOTTA, [0.5, 0.45, 0.5], [x, Y + 0.225, z]);
  box(g, TERRACOTTA, [0.58, 0.08, 0.58], [x, Y + 0.46, z]);
  box(g, LEAF, [0.5, 0.45, 0.5], [x, Y + 0.72, z]);
  for (const [fx, fz] of [
    [-0.15, 0.12],
    [0.14, -0.1],
    [0.05, 0.2],
  ]) {
    box(g, GERANIUM, [0.14, 0.12, 0.14], [x + fx, Y + 0.98, z + fz], { shadow: false });
  }
}

// A-frame chalkboard, its boards facing local ±Z.
function easel(g: THREE.Object3D, x: number, z: number, yaw: number) {
  const e = new THREE.Group();
  const face = new THREE.MeshBasicMaterial({
    map: textTexture(['Ardoise du jour', 'Coq au vin', 'Verre : Morgon'], {
      width: 384,
      height: 480,
      bg: CHALK[0],
      fg: CHALK[1],
      sizes: [30, 34, 26],
      border: WOOD,
    }),
  });
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.y = 1.25;
    leaf.rotation.x = -s * 0.2; // bottoms spread apart
    box(leaf, WOOD, [0.78, 1.2, 0.04], [0, -0.6, 0]);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), face);
    board.position.set(0, -0.6, s * 0.045);
    if (s < 0) board.rotation.y = Math.PI;
    leaf.add(board);
    e.add(leaf);
  }
  box(e, WOOD, [0.82, 0.08, 0.1], [0, 1.25, 0]);
  e.position.set(x, Y, z);
  e.rotation.y = yaw;
  g.add(e);
}

/** « Au Bon Commit »: the owner's bistrot and wine bar, terrace and string lights included. */
export function buildBistro(_i: number, side: number, z: number, deps: BuildingDeps): Lot {
  const g = new THREE.Group();
  placeFacingAvenue(g, side, z);
  const F = BUILDING.depth / 2;
  // Building space: local x = side * dz, local z = F + d.
  const at = (dz: number, d: number): [number, number] => [side * dz, F + d];
  const along = side * (Math.PI / 2); // yaw turning local +Z toward the spawn

  body(g, deps);
  shopfront(g, side, deps.mats.shopGlass);

  const bulb = new THREE.MeshBasicMaterial({ color: BULB[0] });
  for (const piece of TERRACE) {
    const [x, lz] = at(piece.dz, piece.d);
    if (piece.kind === 'table') {
      table(g, x, lz);
      for (const s of [-1, 1]) {
        const [cx, cz] = at(piece.dz + s * CHAIR_OFFSET, piece.d);
        chair(g, cx, cz, s < 0 ? along : -along);
      }
      box(g, bulb, [0.08, 0.1, 0.08], [x, TABLE_TOP + 0.05, lz], { shadow: false }); // candle
    } else if (piece.kind === 'post') {
      box(g, WOOD, [0.12, 3.1, 0.12], [x, Y + 1.55, lz]);
    } else if (piece.kind === 'pot') {
      pot(g, x, lz);
    } else {
      easel(g, x, lz, along);
    }
    const w = lotToWorld(side, z, piece.dz, piece.d);
    deps.colliders.add(w.x, w.z, piece.r);
  }

  // A bottle of red and two glasses on the first table.
  const [tx, tz] = at(TERRACE[0].dz, TERRACE[0].d);
  box(g, BOTTLE, [0.1, 0.26, 0.1], [tx + 0.12, TABLE_TOP + 0.13, tz - 0.1]);
  box(g, BOTTLE, [0.04, 0.12, 0.04], [tx + 0.12, TABLE_TOP + 0.32, tz - 0.1], { shadow: false });
  box(g, '#f1e6cf', [0.105, 0.1, 0.06], [tx + 0.12, TABLE_TOP + 0.12, tz - 0.12], { shadow: false });
  wineGlass(g, ...at(TERRACE[0].dz - 0.2, TERRACE[0].d + 0.15));
  wineGlass(g, ...at(TERRACE[0].dz + 0.22, TERRACE[0].d + 0.18));
  wineGlass(g, ...at(TERRACE[1].dz - 0.18, TERRACE[1].d - 0.1));

  // String lights: festooned along the awning's edge, then zigzagging out over the terrace.
  const edge = F + 1.72;
  for (let k = 0; k < 4; k++) {
    const x0 = -5.6 + k * 2.8;
    strand(g, bulb, [x0, 2.78, edge], [x0 + 2.8, 2.78, edge], 0.25);
  }
  const hook = (dz: number, d: number, y: number): Vec3 => {
    const [x, lz] = at(dz, d);
    return [x, y, lz];
  };
  const corner = hook(6.5, 0.45, 3.3);
  const curbPost = hook(9.6, 2.5, 3.15);
  const backPost = hook(9.6, 0.3, 3.15);
  strand(g, bulb, hook(5.6, 1.72, 2.78), curbPost, 0.3);
  strand(g, bulb, corner, curbPost, 0.3);
  strand(g, bulb, corner, backPost, 0.25);
  strand(g, bulb, curbPost, backPost, 0.2);

  // Warm pool of light on the terrace at night.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: radialTexture('255,200,120'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  const [gx, gz] = at(7, 1.4);
  glow.position.set(gx, Y + 0.05, gz);
  g.add(glow);

  let lastNight = -1;
  return {
    object: g,
    update(_dt: number, _t: number, { night }: WorldEnv) {
      if (Math.abs(night - lastNight) < NIGHT_EPSILON) return;
      lastNight = night;
      bulb.color.lerpColors(...BULB, night);
      glow.material.opacity = night * GLOW_OPACITY;
    },
  };
}
