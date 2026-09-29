import { clamp } from '../utils/math.ts';

// The avenue runs along -Z: the player spawns at +Z and walks toward the contact plaza.
export const ROAD_HALF = 6;
export const WALK_HALF = 10; // outer edge of the sidewalks, where facades start
export const SIDEWALK_Y = 0.12;

export const BUILDING = {
  width: 13, // along the avenue
  depth: 12, // away from the avenue
  groundFloor: 4.8,
  floor: 3.2,
};

const SPAWN_Z = 16;
const FIRST_BUILDING_Z = -22;
const BUILDING_SPACING = 34;
const PLAZA_GAP = 26; // last building → mailbox
const PLAZA = { depth: 16, offset: -4 }; // paved square around the mailbox, centered past endZ
const DASH_EVERY = 6;
const DASH_LENGTH = 2.6;
const CROSSWALK_CLEARANCE = 3;
const BENCH_X = 8.9; // backs onto the facade across the street
const CROSSWALK_STRIPES = 7;
const CROSSWALK_PITCH = 1.6;
const CROSSWALK_HALF = 1.5; // stripes are 3 long along the avenue
const CURB_FOOT = 1.5; // sidewalk depth at each end of a crosswalk, where the hero looks both ways
const STREET_OVERSHOOT = { start: 20, end: 12 }; // road beyond spawn and plaza

/** Where a bench stands and which way its sitter faces. */
export interface BenchSpot {
  x: number;
  z: number;
  heading: number;
}

export interface Layout {
  spawnZ: number;
  archZ: number;
  endZ: number;
  buildingZs: number[];
  crosswalkZs: number[];
  dashZs: number[];
  plaza: { midZ: number; depth: number };
  benches: BenchSpot[];
  street: { length: number; midZ: number };
  walkBounds: { minZ: number; maxZ: number };
  cameraBounds: { minZ: number; maxZ: number };
  sideOf: (i: number) => -1 | 1;
  progressAt: (z: number) => number;
  nearBuilding: (z: number, margin: number) => boolean;
  onCrosswalk: (pos: { x: number; z: number }) => boolean;
  crosswalkFoot: (pos: { x: number; z: number }) => -1 | 0 | 1;
}

/** Pure positions for `count` experiences; every world module reads from here. */
export function createLayout(count: number): Layout {
  const buildingZs = Array.from({ length: count }, (_, i) => FIRST_BUILDING_Z - i * BUILDING_SPACING);
  const endZ = (buildingZs.at(-1) ?? FIRST_BUILDING_Z) - PLAZA_GAP;
  const streetStart = SPAWN_Z + STREET_OVERSHOOT.start;
  const streetEnd = endZ - STREET_OVERSHOOT.end;
  const crosswalkZs = buildingZs.map((z) => z + BUILDING_SPACING / 2);
  const plaza = { midZ: endZ + PLAZA.offset, depth: PLAZA.depth };
  // Plain loop: runs every frame, so no closure per call.
  const alongCrosswalk = (z: number) => {
    for (const c of crosswalkZs) if (Math.abs(z - c) <= CROSSWALK_HALF) return true;
    return false;
  };

  // Center dashes stop short of the plaza: both are painted at the same height, so overlapping would z-fight.
  const plazaEdge = plaza.midZ + plaza.depth / 2 + DASH_LENGTH / 2;
  const dashZs: number[] = [];
  for (let z = SPAWN_Z + 18; z > plazaEdge; z -= DASH_EVERY) {
    if (!crosswalkZs.some((c) => Math.abs(c - z) < CROSSWALK_CLEARANCE)) dashZs.push(z);
  }

  return {
    spawnZ: SPAWN_Z,
    archZ: SPAWN_Z - 8,
    endZ,
    buildingZs,
    crosswalkZs,
    dashZs,
    plaza,
    // Across the street from each experience, so the whole building fits in view.
    benches: buildingZs.map((z, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return { x: -side * BENCH_X, z, heading: (side * Math.PI) / 2 };
    }),
    street: { length: streetStart - streetEnd, midZ: (streetStart + streetEnd) / 2 },
    walkBounds: { minZ: endZ - 4, maxZ: SPAWN_Z + 4 },
    cameraBounds: { minZ: endZ - 9, maxZ: SPAWN_Z + 16 },

    // Buildings alternate sides, first on the left (-X).
    sideOf: (i: number) => (i % 2 === 0 ? -1 : 1),
    progressAt: (z: number) => clamp((SPAWN_Z - z) / (SPAWN_Z - endZ), 0, 1),
    nearBuilding: (z: number, margin: number) => buildingZs.some((b) => Math.abs(z - b) < margin),
    onCrosswalk: ({ x, z }: { x: number; z: number }) => Math.abs(x) < ROAD_HALF && alongCrosswalk(z),
    // The side whose sidewalk meets a crosswalk here, or 0.
    crosswalkFoot({ x, z }: { x: number; z: number }) {
      const ax = Math.abs(x);
      if (ax < ROAD_HALF || ax > ROAD_HALF + CURB_FOOT || !alongCrosswalk(z)) return 0;
      return x < 0 ? -1 : 1;
    },
  };
}

// Integer steps: accumulating 1.6 overshoots 4.8 and silently drops the last stripe.
export const crosswalkStripeXs = Array.from(
  { length: CROSSWALK_STRIPES },
  (_, i) => (i - (CROSSWALK_STRIPES - 1) / 2) * CROSSWALK_PITCH,
);

export const groundHeight = (x: number) => (Math.abs(x) > ROAD_HALF ? SIDEWALK_Y : 0);

/** A lot in the gap between two buildings, on one side of the avenue. */
export interface GapSpot {
  side: -1 | 1;
  z: number;
}

/** The family home: in the gap just past the job held that year, on that job's side. */
export function homeSpot(layout: Layout, starts: readonly number[], year: number): GapSpot | null {
  const i = starts.findLastIndex((s) => s <= year);
  const z = layout.crosswalkZs[i + 1];
  return i < 0 || z === undefined ? null : { side: layout.sideOf(i), z };
}
