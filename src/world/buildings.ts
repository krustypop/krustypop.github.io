import * as THREE from 'three';
import { textTexture } from '../gfx/textures.ts';
import { box, hitbox, signBoard, solid } from '../gfx/voxel.ts';
import { pick, rng } from '../utils/random.ts';
import { buildEmblem } from './emblems.ts';
import { type Era, eraBlocks, eraOf, ERA_STYLES, type Part } from './eras.ts';
import { buildStorefront } from './storefronts.ts';
import { BUILDING, WALK_HALF } from './layout.ts';
import type { Colliders } from './collision.ts';
import type { CityMaterials } from './materials.ts';
import type { Rand, WorldExperience } from './types.ts';
import type { WindowBatch } from './windows.ts';

const FILLER_COLORS = ['#d9cdb8', '#c4b9a8', '#b8c3c7', '#e2d6c2', '#cbbfae'];
const SIGN_COLOR = '#1d1f24';
const TRIM_DARKEN = 0.62;
const COURSE_DARKEN = 0.86;
// Era details reuse colors already in the city, so they merge into existing draw calls.
const STONE = '#e7e0d0';
const STEEL = '#9aa0aa';
const PART_COLORS: Record<Exclude<Part, 'course' | 'spandrel'>, string> = {
  stone: STONE,
  wood: '#3a2a22',
  band: '#eceef4',
  steel: STEEL,
};
const SILLS = { stone: new THREE.Color(STONE), steel: new THREE.Color(STEEL) };
const spandrel = new THREE.MeshStandardMaterial({ color: '#243241', roughness: 0.2, metalness: 0.6 });
const BILLBOARD_TILT = 0.45; // radians toward the road, so boards read from the avenue
const ROOF_EMBLEM_SCALE = 1.4; // roofs are seen from far below: props must read as silhouettes
const BLADE = { x: 5.2, y: 5.6, reach: 3.2, height: 1.9 }; // sticks out over the sidewalk, above the lamps
const BLADE_EMBLEM_SCALE = 0.55;

// Building space: facade on local +Z at z = depth / 2. The group is rotated so it faces the road.
export interface BuildingDeps {
  mats: CityMaterials;
  windows: WindowBatch;
  colliders: Colliders;
}

interface ShellOptions extends BuildingDeps {
  color: THREE.Color;
  floors: number;
  rand: Rand;
  doorColor: string;
  era: Era;
}

export function placeFacingAvenue(group: THREE.Group, side: number, z: number) {
  group.position.set(side * (WALK_HALF + BUILDING.depth / 2), 0, z);
  group.rotation.y = (-side * Math.PI) / 2;
  group.updateMatrix();
}

// Wall color pulled toward the era's material; fillers drift further than jobs.
function eraWall(color: THREE.ColorRepresentation, era: Era, amount: 'tintExperience' | 'tintFiller') {
  const style = ERA_STYLES[era];
  return new THREE.Color(color).lerp(new THREE.Color(style.tint), style[amount]);
}

function shell(group: THREE.Group, { color, floors, rand, doorColor, era, mats, windows }: ShellOptions) {
  const { width: W, depth: D, groundFloor } = BUILDING;
  const style = ERA_STYLES[era];
  const trim = color.clone().multiplyScalar(TRIM_DARKEN);
  const frame = style.steelShell ? STEEL : trim;
  const H = groundFloor + floors * BUILDING.floor;
  const F = D / 2;
  const o = style.corniceOverhang;

  box(group, color, [W, H, D], [0, H / 2, 0]);
  box(group, trim, [W + 0.3, 0.5, D + 0.3], [0, 0.25, 0]);
  box(group, trim, [W + 0.4, 0.35, D + 0.4], [0, groundFloor, 0]);
  // Top stays at H + 0.6 in every era: roof units, billboard and emblem stand on it.
  box(group, frame, [W + 2 * o, 0.6, D + 2 * o], [0, H + 0.3, 0]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(group, frame, [style.pillar, H, style.pillar], [(sx * W) / 2, H / 2, sz * F]);
  }
  windows.addBuilding(group.matrix, floors, style.sill === 'trim' ? trim : SILLS[style.sill], rand);

  const course = color.clone().multiplyScalar(COURSE_DARKEN);
  for (const { part, size, pos, shadow } of eraBlocks(era, floors)) {
    const look = part === 'course' ? course : part === 'spandrel' ? spandrel : PART_COLORS[part];
    box(group, look, size, pos, { shadow });
  }

  box(group, trim, [2.8, 3.1, 0.3], [0, 1.55, F + 0.1]);
  box(group, doorColor, [2.0, 2.7, 0.3], [0, 1.35, F + 0.18]);
  box(group, '#e8c15a', [0.16, 0.16, 0.12], [0.65, 1.35, F + 0.36]);
  for (const sx of [-1, 1]) {
    box(group, trim, [3.5, 2.7, 0.12], [sx * 4, 2.0, F + 0.05]);
    box(group, mats.shopGlass, [3.1, 2.3, 0.14], [sx * 4, 2.0, F + 0.1]);
  }
  for (let k = 0; k < 2; k++) {
    box(group, '#b9bcc2', [1.6, 1, 1.6], [(rand() - 0.5) * 8, H + 1.1, -2.5 - rand() * 2.5]);
  }
  return { trim, H, F };
}

function storefrontSign(group: THREE.Group, company: string, F: number) {
  box(group, SIGN_COLOR, [9.6, 1.0, 0.25], [0, 4.05, F + 0.2]);
  const texture = textTexture([company.toUpperCase()], {
    width: 1150,
    height: 100,
    bg: SIGN_COLOR,
    fg: '#ffffff',
    sizes: [48],
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.8), new THREE.MeshBasicMaterial({ map: texture }));
  sign.position.set(0, 4.05, F + 0.335);
  group.add(sign);
}

function rooftopBillboard(
  group: THREE.Group,
  exp: WorldExperience,
  { color, trim, H, side }: { color: THREE.Color; trim: THREE.Color; H: number; side: number },
) {
  const face = textTexture([exp.company, `${exp.start} – ${exp.end}`], {
    width: 1024,
    height: 384,
    bg: '#fdf7ea',
    fg: SIGN_COLOR,
    sizes: [64, 40],
    border: color.getStyle(),
  });
  const board = signBoard([8, 3, 0.3], face, trim);
  board.position.y = 3.6;

  const stand = new THREE.Group();
  stand.add(board);
  box(stand, trim, [0.3, 2.2, 0.3], [-2.8, 1.1, 0]);
  box(stand, trim, [0.3, 2.2, 0.3], [2.8, 1.1, 0]);
  stand.position.set(0, H + 0.6, 0);
  // World yaw is -side * tilt; subtract the group's own -side * PI/2.
  stand.rotation.y = side * (Math.PI / 2 - BILLBOARD_TILT);
  group.add(stand);
}

// Facades are seen edge-on from the avenue: a sign perpendicular to the wall faces the walker.
function bladeSign(
  group: THREE.Group,
  exp: WorldExperience,
  color: THREE.Color,
  trim: THREE.Color,
  F: number,
  side: number,
) {
  const x = side * BLADE.x; // spawn-side end of the facade, so it is the first thing met
  const face = textTexture(exp.company.split(' / '), {
    width: 640,
    height: 380,
    bg: color.getStyle(),
    fg: '#ffffff',
    sizes: [60, 60],
    border: '#ffffff',
  });
  const faceMat = new THREE.MeshBasicMaterial({ map: face });
  const edge = solid(trim);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z. Both big faces look along the avenue.
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, BLADE.height, BLADE.reach), [
    faceMat,
    faceMat,
    edge,
    edge,
    edge,
    edge,
  ]);
  board.position.set(x, BLADE.y + BLADE.height / 2, F + 0.3 + BLADE.reach / 2);
  board.castShadow = true;
  group.add(board);

  const top = BLADE.y + BLADE.height;
  box(group, trim, [0.25, 0.25, BLADE.reach + 0.5], [x, top + 0.35, F + (BLADE.reach + 0.5) / 2]);
  for (const dz of [0.6, BLADE.reach - 0.2]) box(group, trim, [0.12, 0.35, 0.12], [x, top + 0.12, F + dz]);

  if (!exp.emblem) return;
  const emblem = buildEmblem(group, exp.emblem, color);
  emblem.position.set(x, top + 0.5, F + 0.3 + BLADE.reach / 2);
  emblem.rotation.y = (side * Math.PI) / 2; // its front toward the spawn
  emblem.scale.setScalar(BLADE_EMBLEM_SCALE);
}

export function createExperienceBuilding(
  exp: WorldExperience,
  i: number,
  side: number,
  z: number,
  deps: BuildingDeps,
): THREE.Group {
  const rand = rng(i * 7919 + 1);
  const color = new THREE.Color(exp.color);
  const era = eraOf(Number(exp.start));
  const group = new THREE.Group();
  placeFacingAvenue(group, side, z);

  const { trim, H, F } = shell(group, {
    ...deps,
    color: eraWall(color, era, 'tintExperience'),
    floors: exp.floors ?? 3 + (i % 3),
    rand,
    doorColor: '#3a2a22',
    era,
  });
  const awningColor = color.clone().offsetHSL(0, 0.05, 0.18);
  const awning = ERA_STYLES[era].canopy
    ? () => {
        box(group, STEEL, [4.8, 0.1, 2.0], [0, 3.4, F + 1.0]);
        box(group, awningColor, [4.8, 0.22, 0.08], [0, 3.36, F + 2.04]); // fascia in the job's color
      }
    : () => box(group, awningColor, [4.4, 0.3, 1.8], [0, 3.3, F + 0.9]);
  if (exp.emblem) {
    const spot = new THREE.Vector3();
    buildStorefront(exp.emblem, {
      g: group,
      accent: color,
      trim,
      F,
      side,
      awning,
      block(x, pz, r) {
        spot.set(x, 0, pz).applyMatrix4(group.matrix);
        deps.colliders.add(spot.x, spot.z, r);
      },
    });
  } else awning();
  storefrontSign(group, exp.company, F);
  rooftopBillboard(group, exp, { color, trim, H, side });
  bladeSign(group, exp, color, trim, F, side);
  if (exp.emblem) {
    // Front edge of the roof, beside the billboard, so the tilted board doesn't hide it.
    const roof = buildEmblem(group, exp.emblem, color);
    roof.position.set(side * 3.8, H + 0.6, 4.2);
    roof.scale.setScalar(ROOF_EMBLEM_SCALE);
  }
  hitbox(group, [BUILDING.width, H, BUILDING.depth], [0, H / 2, 0]);
  return group;
}

// Same era as the experience across the street, dated by its start year.
export function createFillerBuilding(
  i: number,
  side: number,
  z: number,
  deps: BuildingDeps,
  year: number,
): THREE.Group {
  const rand = rng(i * 104729 + 7);
  const era = eraOf(year);
  const group = new THREE.Group();
  placeFacingAvenue(group, side, z);
  shell(group, {
    ...deps,
    color: eraWall(pick(rand, FILLER_COLORS), era, 'tintFiller'),
    floors: 2 + Math.floor(rand() * 2) + ERA_STYLES[era].fillerExtraFloors,
    rand,
    doorColor: '#5b5f66',
    era,
  });
  return group;
}
