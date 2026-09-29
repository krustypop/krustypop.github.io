import type * as THREE from 'three';
import { type ArcadeStation, buildArcade } from './arcade.ts';
import { buildBistro } from './bistro.ts';
import { type BuildingDeps, createFillerBuilding } from './buildings.ts';
import type { WorldExperience } from './types.ts';

export interface WorldEnv {
  hour: number;
  night: number;
}

/** What stands across the street from an experience. `update` runs every frame if present. */
export interface Lot {
  object: THREE.Group;
  update?: (dt: number, t: number, env: WorldEnv) => void;
  arcade?: ArcadeStation; // a cabinet the player can play at
}

export type LotBuilder = (i: number, side: number, z: number, deps: BuildingDeps, exp: WorldExperience) => Lot;

// Keyed by experience index; any index not listed gets a plain filler building.
const SPECIAL_LOTS: Partial<Record<number, LotBuilder>> = {
  1: buildBistro,
  4: buildArcade,
};

export function buildOppositeLot(i: number, side: number, z: number, deps: BuildingDeps, exp: WorldExperience): Lot {
  const special = SPECIAL_LOTS[i];
  return special
    ? special(i, side, z, deps, exp)
    : { object: createFillerBuilding(i, side, z, deps, Number(exp.start)) };
}
