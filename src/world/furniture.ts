import * as THREE from 'three';
import { box } from '../gfx/voxel.ts';
import { pick, rng } from '../utils/random.ts';
import type { Colliders } from './collision.ts';
import { type BenchSpot, type Layout, SIDEWALK_Y } from './layout.ts';
import type { CityMaterials } from './materials.ts';
import type { Rand, XZ } from './types.ts';

const LEAVES = ['#4f9a3a', '#5fae45', '#3f8a33'];
const POLE = '#2d3036';
const LAMP_EVERY = 17;
const LAMP_X = 6.7;
const STREET_TREE_X = 8.6;
const STREET_TREE_CLEAR = 8; // half a facade plus a crown: no tree hides a storefront
const PARK_TREES = 90;
const FLOWER_SEED = 1789; // own stream, so beds never shift the city's trees and clouds
const FLOWERS = ['#f28cb1', '#ffd23f', '#ffffff', '#b58cf2', '#ff7b54'];
const SHRUBS = ['#3f8a33', '#4f9a3a', '#5a9e4b'];
const BENCH_WOOD = '#b07a45';
export const SEAT_HEIGHT = 0.55; // above the sidewalk

function tree(scene: THREE.Object3D, rand: Rand, x: number, y: number, z: number) {
  const g = new THREE.Group();
  const trunk = 1.6 + rand() * 0.8;
  const crown = 2 + rand() * 0.8;
  box(g, '#7a5230', [0.5, trunk, 0.5], [0, trunk / 2, 0]);
  box(g, pick(rand, LEAVES), [crown, crown, crown], [0, trunk + crown / 2 - 0.2, 0]);
  const top = crown * 0.6;
  const color = pick(rand, LEAVES);
  box(g, color, [top, top, top], [(rand() - 0.5) * 0.4, trunk + crown + 0.1, (rand() - 0.5) * 0.4]);
  g.position.set(x, y, z);
  g.rotation.y = rand() * Math.PI;
  scene.add(g);
  return g;
}

// Low enough (< 1 m) to never hide a storefront.
function flowerBed(scene: THREE.Object3D, rand: Rand, x: number, z: number) {
  const g = new THREE.Group();
  box(g, '#9e9788', [1.6, 0.3, 1.6], [0, 0.15, 0]);
  box(g, '#5a3d26', [1.3, 0.04, 1.3], [0, 0.32, 0]);
  for (const [sx, sz] of [
    [-0.3, -0.25],
    [0.3, 0.3],
  ]) {
    const s = 0.5 + rand() * 0.25;
    box(g, pick(rand, SHRUBS), [s, s, s], [sx, 0.32 + s / 2, sz]);
  }
  // A ring of flowers around the shrubs, taller than their base so they read from the street.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + rand() * 0.3;
    const [fx, fz] = [Math.cos(a) * 0.55, Math.sin(a) * 0.55];
    const h = 0.35 + rand() * 0.25;
    box(g, '#3f8a33', [0.05, h, 0.05], [fx, 0.32 + h / 2, fz], { shadow: false });
    box(g, pick(rand, FLOWERS), [0.22, 0.18, 0.22], [fx, 0.32 + h + 0.09, fz], { shadow: false });
  }
  g.position.set(x, SIDEWALK_Y, z);
  scene.add(g);
}

// Sitter faces local +Z; the group is turned to the spot's heading.
function bench(scene: THREE.Object3D, { x, z, heading }: BenchSpot) {
  const g = new THREE.Group();
  for (const sz of [-0.2, 0.05, 0.3]) box(g, BENCH_WOOD, [2.4, 0.08, 0.2], [0, SEAT_HEIGHT - 0.04, sz]);
  for (const y of [0.8, 1.05]) box(g, BENCH_WOOD, [2.4, 0.16, 0.08], [0, y, -0.36]);
  for (const sx of [-1, 1]) {
    box(g, POLE, [0.1, SEAT_HEIGHT - 0.08, 0.6], [sx * 1.0, (SEAT_HEIGHT - 0.08) / 2, 0.05]);
    box(g, POLE, [0.1, 1.15, 0.1], [sx * 1.0, 0.58, -0.36]);
    box(g, POLE, [0.1, 0.08, 0.55], [sx * 1.0, 0.72, 0.02]); // armrest
  }
  g.position.set(x, SIDEWALK_Y, z);
  g.rotation.y = heading;
  scene.add(g);
}

// Returns the bulb position, where the light cone starts.
function lamp(scene: THREE.Object3D, mats: CityMaterials, x: number, z: number): XZ {
  const g = new THREE.Group();
  const s = Math.sign(x);
  box(g, POLE, [0.22, 5, 0.22], [0, 2.5, 0]);
  box(g, POLE, [1.2, 0.18, 0.18], [-s * 0.5, 5, 0]);
  box(g, mats.lampBulb, [0.5, 0.25, 0.4], [-s * 1.0, 4.85, 0]);
  g.position.set(x, SIDEWALK_Y, z);
  scene.add(g);
  return { x: x - s * 1.0, z };
}

/** Lamps and trees along the sidewalks, a park behind the buildings, tree walls closing both ends. */
export function buildFurniture(
  scene: THREE.Object3D,
  {
    layout,
    colliders,
    mats,
    rand,
    parkGround,
  }: {
    layout: Layout;
    colliders: Colliders;
    mats: CityMaterials;
    rand: Rand;
    // Height a park tree stands at, or null to leave it out (the trail keeps its path clear).
    parkGround?: (x: number, z: number) => number | null;
  },
): XZ[] {
  const { spawnZ, endZ, archZ } = layout;
  const bulbs: XZ[] = [];
  const flowerRand = rng(FLOWER_SEED);

  for (let z = spawnZ; z > endZ; z -= LAMP_EVERY) {
    for (const s of [-1, 1]) {
      if (!layout.nearBuilding(z, 3) && Math.abs(z - archZ) > 2) {
        bulbs.push(lamp(scene, mats, s * LAMP_X, z));
        colliders.add(s * LAMP_X, z, 0.35);
      }
      const tz = z - LAMP_EVERY / 2;
      if (!layout.nearBuilding(tz, STREET_TREE_CLEAR) && tz > endZ + 2) {
        box(scene, '#6b4a2e', [1.4, 0.02, 1.4], [s * STREET_TREE_X, SIDEWALK_Y + 0.01, tz]);
        tree(scene, rand, s * STREET_TREE_X, SIDEWALK_Y, tz);
        colliders.add(s * STREET_TREE_X, tz, 0.6);
      } else if (!layout.nearBuilding(tz, 4) && tz > endZ + 2) {
        flowerBed(scene, flowerRand, s * STREET_TREE_X, tz);
        colliders.add(s * STREET_TREE_X, tz, 0.8);
      }
    }
  }

  for (const spot of layout.benches) {
    bench(scene, spot);
    for (const dz of [-0.7, 0.7]) colliders.add(spot.x, spot.z + dz, 0.55);
    for (const dz of [-2.2, 2.2]) {
      flowerBed(scene, flowerRand, spot.x, spot.z + dz);
      colliders.add(spot.x, spot.z + dz, 0.8);
    }
  }

  for (let i = 0; i < PARK_TREES; i++) {
    const x = (rand() < 0.5 ? -1 : 1) * (12 + rand() * 18);
    const z = endZ - 10 + rand() * (spawnZ + 24 - endZ);
    // Skip the lots where buildings stand.
    if (Math.abs(x) >= 24 || !layout.nearBuilding(z, 8.5)) {
      // Built even when dropped, so the rand() calls after it stay in place.
      const g = tree(scene, rand, x, 0, z);
      const y = parkGround ? parkGround(x, z) : 0;
      if (y === null) g.removeFromParent();
      else g.position.y = y;
    }
  }

  for (let x = -30; x <= 30; x += 3.2) {
    tree(scene, rand, x + rand(), 0, endZ - 15 - rand() * 2);
    tree(scene, rand, x + rand(), 0, spawnZ + 18 + rand() * 2);
  }

  return bulbs;
}
