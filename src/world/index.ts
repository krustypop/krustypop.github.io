import * as THREE from 'three';
import { mergeStatic } from '../gfx/voxel.ts';
import { clamp } from '../utils/math.ts';
import { rng } from '../utils/random.ts';
import { createExperienceBuilding } from './buildings.ts';
import { createCat } from './cat.ts';
import { createClouds } from './clouds.ts';
import { type Colliders, createColliders } from './collision.ts';
import { buildFurniture, SEAT_HEIGHT } from './furniture.ts';
import { buildHome, onHomeLot } from './home.ts';
import { createLampLights } from './lampLights.ts';
import { buildArch, buildContactPlaza } from './landmarks.ts';
import type { ArcadeStation } from './arcade.ts';
import { buildOppositeLot, type Lot, type WorldEnv } from './lots.ts';
import { createLayout, groundHeight, homeSpot, SIDEWALK_Y, WALK_HALF } from './layout.ts';
import { createCityMaterials } from './materials.ts';
import { createPedestrians } from './pedestrians.ts';
import { createPigeons } from './pigeons.ts';
import { buildSigns } from './signs.ts';
import { buildStreet } from './street.ts';
import { animatePads, contactTarget, experienceTarget, nearestTarget, type Target } from './targets.ts';
import { buildTrail, parkGround, planTrail } from './trail.ts';
import type { WorldExperience, WorldProfile, XZ } from './types.ts';
import { createWindowBatch } from './windows.ts';

const CITY_SEED = 42;
const CAMERA_MARGIN = 0.4;

/** A bench facing an experience: sit on it to take in the whole building. */
export interface Bench {
  type: 'bench';
  label: string;
  exp: WorldExperience;
  seat: XZ;
  seatY: number;
  heading: number;
}

/** What the world may read of the player each frame (people and animals react to it). */
export interface PlayerView {
  pos: XZ;
  speed: number;
  seated: boolean;
}

export interface World {
  spawn: THREE.Vector3;
  spawnHeading: number;
  targets: Target[];
  clickables: THREE.Object3D[];
  progressAt: (z: number) => number;
  groundHeight: (x: number) => number;
  resolve: Colliders['resolve'];
  nearestTarget: (pos: XZ, reach: number) => Target | null;
  nearestBench: (pos: XZ, reach: number) => Bench | null;
  nearestArcade: (pos: XZ, reach: number) => ArcadeStation | null;
  onCrosswalk: (pos: XZ) => boolean;
  crosswalkFoot: (pos: XZ) => -1 | 0 | 1;
  /** Passers-by, pigeons and the cat, exposed for `?debug`. */
  life: {
    pedestrians: ReturnType<typeof createPedestrians>;
    pigeons: ReturnType<typeof createPigeons>;
    cat: ReturnType<typeof createCat>;
  };
  clampCamera: (v: THREE.Vector3) => void;
  update: (dt: number, t: number, active: Target | null, env: WorldEnv, player: PlayerView) => void;
}

export function createWorld(
  scene: THREE.Scene,
  { profile, experiences }: { profile: WorldProfile; experiences: readonly WorldExperience[] },
): World {
  const layout = createLayout(experiences.length);
  const mats = createCityMaterials();
  const colliders = createColliders(layout.walkBounds);
  const windows = createWindowBatch(mats);
  const rand = rng(CITY_SEED);

  buildStreet(scene, layout);

  const lots: Lot[] = [];

  // Each experience faces a plain filler building across the street.
  const targets = experiences.map((exp, i): Target => {
    const side = layout.sideOf(i);
    const z = layout.buildingZs[i];
    const object = createExperienceBuilding(exp, i, side, z, { mats, windows, colliders });
    const lot = buildOppositeLot(i, -side, z, { mats, windows, colliders }, exp);
    scene.add(object, lot.object);
    lots.push(lot);
    return experienceTarget(scene, { exp, object, side, z, layout, mats });
  });

  const arcades = lots.flatMap((lot) => (lot.arcade ? [lot.arcade] : []));

  const benches = layout.benches.map(({ x, z, heading }, i): Bench => ({
    type: 'bench',
    label: experiences[i].company,
    exp: experiences[i],
    seat: { x, z },
    seatY: SIDEWALK_Y + SEAT_HEIGHT,
    heading,
  }));

  buildArch(scene, layout, profile, colliders);
  const mailbox = buildContactPlaza(scene, layout, profile, colliders);
  targets.push(contactTarget(scene, { object: mailbox, layout }));

  const trail = planTrail(layout);
  const homeLot = homeSpot(
    layout,
    experiences.map((e) => Number(e.start)),
    profile.family.firstChild,
  );
  const bulbs = buildFurniture(scene, {
    layout,
    colliders,
    mats,
    rand,
    parkGround: (x, z) => (homeLot && onHomeLot(homeLot, x, z) ? null : parkGround(trail, x, z)),
  });
  buildTrail(scene, trail);
  const home = homeLot && buildHome(scene, homeLot, { mats, colliders, year: profile.family.firstChild });
  buildSigns(scene, { layout, colliders });
  windows.build(scene);
  const pedestrians = createPedestrians(scene, {
    colliders,
    benches,
    minZ: layout.endZ + 3,
    maxZ: layout.spawnZ + 2.5,
  });
  const pigeons = createPigeons(scene, { colliders, layout });
  // Napping on a shop-window ledge across from the first experience, just past the bench.
  const cat = createCat(scene, {
    colliders,
    home: { x: -layout.sideOf(0) * WALK_HALF, z: layout.buildingZs[0] + 4 },
    facade: WALK_HALF,
  });
  const clouds = createClouds(scene, {
    rand,
    material: mats.cloud,
    zMin: layout.endZ - 60,
    zMax: layout.spawnZ + 60,
  });

  mergeStatic(scene);
  const lampLights = createLampLights(scene, bulbs);

  return {
    spawn: new THREE.Vector3(0, 0, layout.spawnZ),
    spawnHeading: Math.PI,
    targets,
    clickables: targets.map((t) => t.object),
    progressAt: layout.progressAt,
    groundHeight,
    resolve: colliders.resolve,
    nearestTarget: (pos: XZ, reach: number) => nearestTarget(targets, pos, reach),
    nearestBench: (pos: XZ, reach: number) => nearestTarget(benches, pos, reach, (b) => b.seat),
    nearestArcade: (pos: XZ, reach: number) => nearestTarget(arcades, pos, reach, (a) => a.spot),
    onCrosswalk: layout.onCrosswalk,
    crosswalkFoot: layout.crosswalkFoot,
    life: { pedestrians, pigeons, cat },

    // Keeps the camera on the avenue so it never clips into a building.
    clampCamera(v: THREE.Vector3) {
      v.x = clamp(v.x, -WALK_HALF + CAMERA_MARGIN, WALK_HALF - CAMERA_MARGIN);
      v.z = clamp(v.z, layout.cameraBounds.minZ, layout.cameraBounds.maxZ);
    },

    update(dt: number, t: number, active: Target | null, env: WorldEnv, player: PlayerView) {
      const { night } = env;
      for (const lot of lots) lot.update?.(dt, t, env);
      animatePads(targets, active, t);
      clouds.update(dt);
      mats.setNight(night);
      lampLights.setNight(night);
      windows.update(env.hour, night);
      pedestrians.update(dt, player.pos);
      pigeons.update(dt, t, player.pos, player.speed, pedestrians.walkers);
      cat.update(dt, t, player.pos);
      home?.update(dt, t, player.pos);
    },
  };
}
