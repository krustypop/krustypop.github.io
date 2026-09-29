import * as THREE from 'three';
import { textTexture } from '../gfx/textures.ts';
import { box, type Vec3 } from '../gfx/voxel.ts';
import { pick, rng } from '../utils/random.ts';
import { INK } from './emblems.ts';
import { type Layout, WALK_HALF } from './layout.ts';
import type { Rand, XZ } from './types.ts';

export const PATH_HALF = 0.7;
const TREE_CLEAR = 1.3; // park trunks keep this far past the path's edge
const SAMPLE = 0.4;
const TILE = 0.5; // divides the 1 m hill cell, so every tile sits on a single step
const HILL = { u: 24, radius: 9, height: 3.5, step: 0.5 };
// [u, v]: u away from the facades, v along the avenue. Winds through the gap, then climbs to the hilltop.
const WAYPOINTS: [number, number][] = [
  [0, 0],
  [2.5, 0.4],
  [5.5, 2.2],
  [8.5, 0.2],
  [11.5, -2.2],
  [14.5, -1.2],
  [17.5, 1.6],
  [20.5, 1.8],
  [22.5, 0.6],
  [HILL.u, 0],
];

const TRAIL_SEED = 3776; // own stream, so the trail never shifts the city's trees
const ROCK_COUNT = 30;
const PINE_COUNT = 9;
const DIRT = ['#a67c52', '#98704a'];
const GRASS = ['#78b35a', '#6ea653'];
const ROCKS = ['#9e9788', '#b9bcc2', '#8a8478'];
const PINE = ['#2f6b3a', '#3b7d45'];
const TRUNK = '#7a5230';
const SIGN_WOOD = '#8a5a36';
const SIGN_YELLOW = '#f2c14e';
const BLAZE_WHITE = '#ffffff';
const BLAZE_RED = '#d0343a';

export interface Hill {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface TrailPlan {
  side: -1 | 1;
  startZ: number;
  points: XZ[];
  hill: Hill;
}

function catmullRom(pts: XZ[], spacing: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(i - 1, 0)], pts[i], pts[i + 1], pts[Math.min(i + 2, pts.length - 1)]];
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const [t2, t3] = [t * t, t * t * t];
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...pts.at(-1)! });
  return out;
}

/** The hiking trail: from the sidewalk edge at the crosswalk between the first two buildings, up a hill in the park. */
export function planTrail(layout: Layout): TrailPlan {
  const side = layout.sideOf(0);
  const startZ = layout.crosswalkZs[1] ?? layout.crosswalkZs[0];
  const toWorld = ([u, v]: [number, number]): XZ => ({ x: side * (WALK_HALF + u), z: startZ + v });
  return {
    side,
    startZ,
    points: catmullRom(WAYPOINTS.map(toWorld), SAMPLE),
    hill: { ...toWorld([HILL.u, 0]), radius: HILL.radius, height: HILL.height },
  };
}

export function distanceToPath(points: XZ[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const [dx, dz] = [points[i + 1].x - a.x, points[i + 1].z - a.z];
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return best;
}

/** Terraced dome on a 1 m grid: the top of the cell containing (x, z). */
export function hillHeight(hill: Hill, x: number, z: number): number {
  const [cx, cz] = [Math.floor(x) + 0.5, Math.floor(z) + 0.5];
  const r2 = ((cx - hill.x) ** 2 + (cz - hill.z) ** 2) / hill.radius ** 2;
  if (r2 >= 1) return 0;
  return Math.round((hill.height * (1 - r2)) / HILL.step) * HILL.step;
}

// Lowest step under a footprint, so nothing floats over a lower terrace.
function groundAt(hill: Hill, x: number, z: number, half: number) {
  return Math.min(
    hillHeight(hill, x - half, z - half),
    hillHeight(hill, x + half, z - half),
    hillHeight(hill, x - half, z + half),
    hillHeight(hill, x + half, z + half),
  );
}

/** Where a park tree at (x, z) stands, or null when it would block the trail. */
export function parkGround(plan: TrailPlan, x: number, z: number): number | null {
  if (distanceToPath(plan.points, x, z) < PATH_HALF + TREE_CLEAR) return null;
  return groundAt(plan.hill, x, z, 0.25);
}

// GR mark: a white stripe over a red one, painted on the face of a post or trunk.
function blaze(parent: THREE.Object3D, [x, y, z]: Vec3, half: number, nx: number, nz: number) {
  const out = half + 0.03;
  const size: Vec3 = nx ? [0.03, 0.06, 0.2] : [0.2, 0.06, 0.03];
  box(parent, BLAZE_WHITE, size, [x + nx * out, y + 0.035, z + nz * out], { shadow: false });
  box(parent, BLAZE_RED, size, [x + nx * out, y - 0.035, z + nz * out], { shadow: false });
}

function hillSteps(g: THREE.Object3D, h: Hill) {
  for (let ix = Math.floor(h.x - h.radius); ix < h.x + h.radius; ix++) {
    for (let iz = Math.floor(h.z - h.radius); iz < h.z + h.radius; iz++) {
      const top = hillHeight(h, ix + 0.5, iz + 0.5);
      if (top > 0) box(g, GRASS[Math.round(top / HILL.step) % 2], [1, top, 1], [ix + 0.5, top / 2, iz + 0.5]);
    }
  }
}

function path(g: THREE.Object3D, { points, hill: h }: TrailPlan, rand: Rand) {
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const [x0, x1] = [Math.min(...xs) - PATH_HALF, Math.max(...xs) + PATH_HALF];
  const [z0, z1] = [Math.min(...zs) - PATH_HALF, Math.max(...zs) + PATH_HALF];
  for (let x = Math.floor(x0 / TILE) * TILE; x < x1; x += TILE) {
    for (let z = Math.floor(z0 / TILE) * TILE; z < z1; z += TILE) {
      const [cx, cz] = [x + TILE / 2, z + TILE / 2];
      if (Math.abs(cx) < WALK_HALF || distanceToPath(points, cx, cz) > PATH_HALF) continue;
      const y = hillHeight(h, cx, cz);
      box(g, pick(rand, DIRT), [TILE, 0.06, TILE], [cx, y + 0.01, cz], { shadow: false });
    }
  }
}

function rocks(g: THREE.Object3D, { points, hill: h }: TrailPlan, rand: Rand) {
  for (let k = 0; k < ROCK_COUNT; k++) {
    const i = 1 + Math.floor(rand() * (points.length - 2));
    const s = 0.3 + rand() * 0.6;
    const off = (rand() < 0.5 ? -1 : 1) * (PATH_HALF + s / 2 + 0.2 + rand() * 1.6);
    const [tall, color, yaw] = [0.5 + rand() * 0.4, pick(rand, ROCKS), rand() * Math.PI];
    const [a, b] = [points[i - 1], points[i + 1]];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const x = points[i].x - ((b.z - a.z) / len) * off;
    const z = points[i].z + ((b.x - a.x) / len) * off;
    // Bends bring the other side of the path close again.
    if (Math.abs(x) < WALK_HALF + s || distanceToPath(points, x, z) < PATH_HALF + s * 0.75) continue;
    const y = groundAt(h, x, z, s / 2);
    box(g, color, [s, s * tall, s * 0.85], [x, y + (s * tall) / 2 - 0.04, z]).rotation.y = yaw;
  }
}

function pine(g: THREE.Object3D, rand: Rand, [x, y, z]: Vec3, scale: number) {
  const p = new THREE.Group();
  box(p, TRUNK, [0.35, 1.0, 0.35], [0, 0.5, 0]);
  [1.9, 1.4, 0.9, 0.4].forEach((w, k) => box(p, pick(rand, PINE), [w, 0.8, w], [0, 1.25 + k * 0.7, 0]));
  p.position.set(x, y, z);
  p.scale.setScalar(scale);
  g.add(p);
  return p;
}

function pines(g: THREE.Object3D, { side, points, hill: h }: TrailPlan, rand: Rand) {
  for (let k = 0; k < PINE_COUNT; k++) {
    const [a, r, scale] = [rand() * Math.PI * 2, 2.5 + rand() * (h.radius - 3), 0.9 + rand() * 0.5];
    const [x, z] = [h.x + Math.cos(a) * r, h.z + Math.sin(a) * r];
    if (distanceToPath(points, x, z) < PATH_HALF + 1.2) continue;
    pine(g, rand, [x, groundAt(h, x, z, 0.2), z], scale);
  }
  // Two blazed pines along the way up, marks facing the avenue and the spawn.
  for (const [i, off] of [
    [Math.floor(points.length * 0.3), 1.6],
    [Math.floor(points.length * 0.62), -1.7],
  ] as const) {
    const [x, z] = [points[i].x, points[i].z + off];
    const y = groundAt(h, x, z, 0.2);
    const p = pine(g, rand, [x, y, z], 1);
    blaze(p, [0, 0.6, 0], 0.175, -side, 0);
    blaze(p, [0, 0.6, 0], 0.175, 0, 1);
  }
}

function arrowBoard(g: THREE.Object3D, side: number, lines: string[], [x, y, z]: Vec3) {
  box(g, SIGN_YELLOW, [1.6, 0.36, 0.05], [x, y, z]);
  box(g, SIGN_YELLOW, [0.26, 0.26, 0.05], [x + side * 0.8, y, z]).rotation.z = Math.PI / 4;
  const face = new THREE.MeshBasicMaterial({
    map: textTexture(lines, { width: 512, height: 112, bg: SIGN_YELLOW, fg: INK, sizes: [34, 28] }),
  });
  for (const s of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), face);
    plane.position.set(x, y, z + s * 0.05);
    if (s < 0) plane.rotation.y = Math.PI;
    g.add(plane);
  }
}

// At the trailhead, boards pointing into the park so a walker coming down the avenue reads them.
function signpost(g: THREE.Object3D, { side, startZ }: TrailPlan) {
  const [x, z] = [side * (WALK_HALF + 0.9), startZ + 1.7];
  box(g, SIGN_WOOD, [0.16, 2.4, 0.16], [x, 1.2, z]);
  box(g, SIGN_WOOD, [0.24, 0.08, 0.24], [x, 2.44, z]);
  const bx = x + side * 0.9;
  arrowBoard(g, side, ['Ridge trail', '2 km'], [bx, 2.05, z]);
  arrowBoard(g, side, ['Lookout', '800 m'], [bx, 1.6, z]);
  blaze(g, [x, 1.1, z], 0.08, -side, 0);
  blaze(g, [x, 1.1, z], 0.08, 0, 1);
}

// Stacked stones marking the summit, with a last blaze on a stake.
function cairn(g: THREE.Object3D, { side, hill: h }: TrailPlan) {
  const [x, z] = [h.x + side * 1.1, h.z];
  let y = groundAt(h, x, z, 0.45);
  for (const [w, t, yaw] of [
    [0.9, 0.35, 0.2],
    [0.7, 0.3, 0.9],
    [0.5, 0.28, 0.4],
    [0.3, 0.25, 1.1],
  ]) {
    box(g, ROCKS[yaw > 0.5 ? 0 : 2], [w, t, w * 0.85], [x, y + t / 2, z]).rotation.y = yaw;
    y += t - 0.02;
  }
  const sx = h.x - side * 0.2;
  const sz = h.z + 1.1;
  const sy = groundAt(h, sx, sz, 0.1);
  box(g, SIGN_WOOD, [0.14, 1.3, 0.14], [sx, sy + 0.65, sz]);
  blaze(g, [sx, sy + 1.05, sz], 0.07, -side, 0);
}

/** Scenery only: the walk bounds keep the player on the avenue, so it is framed by the gap between buildings. */
export function buildTrail(scene: THREE.Object3D, plan: TrailPlan) {
  const rand = rng(TRAIL_SEED);
  const g = new THREE.Group();
  hillSteps(g, plan.hill);
  path(g, plan, rand);
  rocks(g, plan, rand);
  pines(g, plan, rand);
  signpost(g, plan);
  cairn(g, plan);
  scene.add(g);
}
