import { BUILDING } from './layout.ts';

// The avenue ages with the career: old brick at the entrance, glass towers at the end.
export type Era = 'brick' | 'render' | 'glass';

// Latest first: a building belongs to the first era it has reached.
const ERA_FROM: readonly [year: number, era: Era][] = [
  [2020, 'glass'],
  [2014, 'render'],
];

export function eraOf(year: number): Era {
  return ERA_FROM.find(([from]) => year >= from)?.[1] ?? 'brick';
}

export interface EraStyle {
  tint: string; // walls drift toward this material
  tintExperience: number; // light: the job's color is its identity
  tintFiller: number;
  fillerExtraFloors: number; // the skyline grows with the years
  corniceOverhang: number;
  pillar: number; // corner pillar width
  steelShell: boolean; // pillars and cornice in steel instead of trim
  sill: 'stone' | 'steel' | 'trim';
  canopy: boolean; // slim steel canopy instead of a fabric awning
}

export const ERA_STYLES: Record<Era, EraStyle> = {
  brick: {
    tint: '#a3563f',
    tintExperience: 0.25,
    tintFiller: 0.5,
    fillerExtraFloors: 0,
    corniceOverhang: 0.45,
    pillar: 0.7,
    steelShell: false,
    sill: 'stone',
    canopy: false,
  },
  render: {
    tint: '#efe9dd',
    tintExperience: 0.2,
    tintFiller: 0.45,
    fillerExtraFloors: 1,
    corniceOverhang: 0.3,
    pillar: 0.7,
    steelShell: false,
    sill: 'trim',
    canopy: false,
  },
  glass: {
    tint: '#9fb4c8',
    tintExperience: 0.2,
    tintFiller: 0.5,
    fillerExtraFloors: 2,
    corniceOverhang: 0.27, // flush with the pillars: a crisp roofline
    pillar: 0.5,
    steelShell: true,
    sill: 'steel',
    canopy: true,
  },
};

export type Part = 'course' | 'stone' | 'wood' | 'band' | 'steel' | 'spandrel';
type Vec3 = [number, number, number];

/** A facade detail in building space (facade on +Z at z = depth / 2, side walls on ±X). */
export interface Block {
  part: Part;
  size: Vec3;
  pos: Vec3;
  shadow: boolean;
}

interface Wall {
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
}

const { width: W, depth: D, groundFloor: GF, floor: FL } = BUILDING;
const F = D / 2;
const FRONT_COLUMNS = 4;
const SIDE_COLUMNS = 3;
const PANE = { w: 1.6, h: 1.8 };
const FRONT: Wall = { x: 0, y: 0, z: F, nx: 0, nz: 1 };
const SIDES: Wall[] = [-1, 1].map((s) => ({ x: (s * W) / 2, y: 0, z: 0, nx: s, nz: 0 }));

export const buildingHeight = (floors: number) => GF + floors * FL;

// Mirrors the window slots of windows.ts; tests check details against the real panes.
function paneSlots(floors: number): Wall[] {
  const slots: Wall[] = [];
  for (let f = 0; f < floors; f++) {
    const y = GF + f * FL + FL * 0.55;
    for (let c = 0; c < FRONT_COLUMNS; c++) slots.push({ ...FRONT, x: -W / 2 + ((c + 0.5) * W) / FRONT_COLUMNS, y });
    for (let c = 0; c < SIDE_COLUMNS; c++) {
      for (const s of SIDES) slots.push({ ...s, y, z: -D / 2 + ((c + 0.5) * D) / SIDE_COLUMNS });
    }
  }
  return slots;
}

// `along` runs along the wall, `out` is how far the block stands proud of it.
function onWall(part: Part, w: Wall, along: number, y: number, [len, h, out]: Vec3, shadow = true): Block {
  return w.nz
    ? { part, size: [len, h, out], pos: [w.x + along, y, w.z + (w.nz * out) / 2], shadow }
    : { part, size: [out, h, len], pos: [w.x + (w.nx * out) / 2, y, w.z + along], shadow };
}

// Wraps all four walls at once.
const ring = (part: Part, y: number, h: number, out: number, shadow = true): Block => ({
  part,
  size: [W + 2 * out, h, D + 2 * out],
  pos: [0, y, 0],
  shadow,
});

// Centered in the gap between a pane's top and the next floor's sill.
const betweenFloors = (floors: number) => Array.from({ length: floors - 1 }, (_, f) => GF + (f + 1) * FL + 0.08);

function brick(floors: number): Block[] {
  const H = buildingHeight(floors);
  const blocks: Block[] = [];
  for (let y = 0.9; y < H - 0.4; y += 0.5) {
    if (Math.abs(y - GF) > 0.3) blocks.push(ring('course', y, 0.08, 0.03, false));
  }
  for (const s of paneSlots(floors)) {
    const top = s.y + PANE.h / 2;
    blocks.push(onWall('stone', s, 0, top + 0.16, [2.0, 0.28, 0.14]));
    if (s.nz) blocks.push(onWall('stone', s, 0, top + 0.18, [0.34, 0.32, 0.2])); // keystone
  }
  // Quoins stand just proud of the corner pillars.
  for (let y = GF + 0.6; y + 0.2 < H - 0.25; y += 0.8) {
    for (const sx of [-1, 1])
      blocks.push({ part: 'stone', size: [0.8, 0.4, 0.8], pos: [(sx * W) / 2, y, F], shadow: true });
  }
  for (let k = 0; k < 22; k++) blocks.push(onWall('stone', FRONT, -5.775 + k * 0.55, H - 0.09, [0.24, 0.18, 0.16]));
  for (const s of SIDES) {
    for (let k = 0; k < 20; k++) blocks.push(onWall('stone', s, -5.225 + k * 0.55, H - 0.09, [0.24, 0.18, 0.16]));
  }
  // Wooden shopfront around both shop windows, under the storefront sign.
  for (const x of [-6, -2, 2, 6]) blocks.push(onWall('wood', FRONT, x, 2.0, [0.24, 3.0, 0.12]));
  for (const x of [-4, 4]) blocks.push(onWall('wood', FRONT, x, 3.42, [4.24, 0.2, 0.14]));
  return blocks;
}

function render(floors: number): Block[] {
  const blocks = betweenFloors(floors).map((y) => ring('band', y, 0.42, 0.07));
  for (const s of paneSlots(floors)) {
    for (const a of [-0.87, 0.87]) blocks.push(onWall('steel', s, a, s.y + 0.01, [0.1, 1.82, 0.17]));
    blocks.push(onWall('steel', s, 0, s.y + 0.98, [1.84, 0.12, 0.17]));
  }
  return blocks;
}

function glass(floors: number): Block[] {
  const H = buildingHeight(floors);
  const blocks = betweenFloors(floors).map((y) => ring('spandrel', y, 1.12, 0.08, false));
  blocks.push(ring('spandrel', H - 0.24, 0.44, 0.08, false));
  // Mullions between window columns, from the ground-floor band up to the parapet.
  const bottom = GF + 0.2;
  const top = H - 0.02;
  const size: Vec3 = [0.24, top - bottom, 0.22];
  for (let c = 1; c < FRONT_COLUMNS; c++)
    blocks.push(onWall('steel', FRONT, -W / 2 + (c * W) / FRONT_COLUMNS, (top + bottom) / 2, size));
  for (const s of SIDES) {
    for (let c = 1; c < SIDE_COLUMNS; c++)
      blocks.push(onWall('steel', s, -D / 2 + (c * D) / SIDE_COLUMNS, (top + bottom) / 2, size));
  }
  return blocks;
}

const DETAILS: Record<Era, (floors: number) => Block[]> = { brick, render, glass };

/** The era's facade details for a shell of `floors` floors. */
export function eraBlocks(era: Era, floors: number): Block[] {
  return DETAILS[era](floors);
}
