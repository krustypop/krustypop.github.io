import * as THREE from 'three';
import { coloredBlocks, instanced } from '../gfx/voxel.ts';
import { clamp, damp } from '../utils/math.ts';
import { rng } from '../utils/random.ts';
import type { Colliders } from './collision.ts';
import { groundHeight, type Layout } from './layout.ts';
import { arcPoint, shouldFlee } from './life.ts';
import type { XZ } from './types.ts';

const FLOCKS = 6;
const SEED = 7331;
const RADIUS = 0.12;
const WALKER_SCARE = 1; // passers-by only scatter them by walking right into the flock
const LAND_AWAY = 15; // a new spot this far from the player, when there is one
const WANDER_SPEED = 0.35;
const PECK_PIVOT = 0.15;
const WING = { x: 0.09, y: 0.22, z: -0.02 };
const TINTS = ['#ffffff', '#e4e4e4', '#cfcfcf', '#e8ddd0', '#b9b9bd'];

const BODY = coloredBlocks([
  ['#9aa0ab', [0.2, 0.17, 0.32], [0, 0.17, 0]],
  ['#7d8491', [0.22, 0.06, 0.2], [0, 0.22, -0.05]], // folded wings
  ['#5f7f78', [0.13, 0.1, 0.12], [0, 0.27, 0.11]], // iridescent neck
  ['#6f7784', [0.12, 0.12, 0.13], [0, 0.34, 0.15]],
  ['#3a3a3a', [0.04, 0.04, 0.07], [0, 0.33, 0.24]],
  ['#4e545e', [0.14, 0.04, 0.16], [0, 0.16, -0.22]],
  ['#c9525a', [0.03, 0.08, 0.03], [-0.05, 0.04, 0.02]],
  ['#c9525a', [0.03, 0.08, 0.03], [0.05, 0.04, 0.02]],
]);
// Pivots at the shoulder and spreads along +X; the left wing is the same block turned half a turn.
const WING_GEOMETRY = coloredBlocks([
  ['#8a919e', [0.26, 0.03, 0.2], [0.13, 0, 0]],
  ['#4e545e', [0.08, 0.031, 0.2], [0.24, 0, 0]],
]);

interface Spot {
  x: number;
  z: number;
  rx: number; // spread across / along the avenue
  rz: number;
}

interface Pigeon {
  pos: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  yaw: number;
  t: number; // flight progress, 1 once landed
  delay: number;
  duration: number;
  height: number;
  peck: number;
  wander: XZ;
  wanderTimer: number;
}

interface Flock {
  spot: number;
  members: Pigeon[];
  flying: boolean;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Crumbs in front of every bench, a strip along the curb between buildings, and the contact plaza.
// The curb strip stays roadward of the passers-by lane and of the bistro terrace (z + 3 … z + 11).
function landingSpots(layout: Layout): Spot[] {
  const spots: Spot[] = [];
  layout.benches.forEach(({ x, z }) => {
    const s = Math.sign(x);
    spots.push({ x: s * 8.2, z, rx: 0.2, rz: 1.2 }, { x: s * 6.85, z: z + 10, rx: 0.12, rz: 1.5 });
  });
  const { endZ } = layout;
  spots.push(
    { x: -3.5, z: endZ + 4, rx: 1.4, rz: 1.4 },
    { x: 3.5, z: endZ + 5, rx: 1.4, rz: 1.4 },
    { x: -1.5, z: endZ - 6, rx: 1.4, rz: 1.4 },
  );
  return spots;
}

/** Small flocks pecking about; they take off in an arc when someone comes close, and land elsewhere. */
export function createPigeons(scene: THREE.Object3D, { colliders, layout }: { colliders: Colliders; layout: Layout }) {
  const rand = rng(SEED);
  const chance = rng(SEED + 1);
  const spots = landingSpots(layout);
  const taken = spots.map(() => false);
  const target = { x: 0, z: 0 };

  function spotPoint(spot: Spot, r: () => number, out: THREE.Vector3) {
    target.x = spot.x + (r() * 2 - 1) * spot.rx;
    target.z = spot.z + (r() * 2 - 1) * spot.rz;
    colliders.resolve(target, RADIUS);
    return out.set(target.x, groundHeight(target.x), target.z);
  }

  // The first bench and the plaza always have a flock; the others are seeded.
  const starts = [0, spots.length - 3];
  while (starts.length < FLOCKS) {
    const k = Math.floor(rand() * spots.length);
    if (!starts.includes(k)) starts.push(k);
  }

  const flocks: Flock[] = starts.map((spot): Flock => {
    taken[spot] = true;
    const members = Array.from({ length: 3 + Math.floor(rand() * 3) }, (): Pigeon => {
      const pos = spotPoint(spots[spot], rand, new THREE.Vector3());
      return {
        pos,
        from: pos.clone(),
        to: pos.clone(),
        yaw: rand() * Math.PI * 2,
        t: 1,
        delay: 0,
        duration: 1,
        height: 0,
        peck: rand() * 10,
        wander: { x: pos.x, z: pos.z },
        wanderTimer: rand() * 3,
      };
    });
    return { spot, members, flying: false };
  });
  const all = flocks.flatMap((f) => f.members);

  const group = new THREE.Group();
  group.userData.dynamic = true;
  scene.add(group);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const tints = all.map(() => new THREE.Color(TINTS[Math.floor(rand() * TINTS.length)]));
  const bodies = instanced(
    group,
    BODY,
    material,
    all.map(() => new THREE.Matrix4()),
    tints,
  );
  bodies.castShadow = true;
  const wings = instanced(
    group,
    WING_GEOMETRY,
    material,
    all.flatMap(() => [HIDDEN, HIDDEN]),
    all.flatMap((_, i) => [tints[i], tints[i]]),
  );

  function pickSpot(player: XZ, current: number) {
    for (let tries = 0; tries < 12; tries++) {
      const k = Math.floor(chance() * spots.length);
      const s = spots[k];
      const far = Math.hypot(s.x - player.x, s.z - player.z) > LAND_AWAY || tries > 8;
      if (k !== current && !taken[k] && far) return k;
    }
    return current;
  }

  function takeOff(flock: Flock, player: XZ) {
    const next = pickSpot(player, flock.spot);
    taken[flock.spot] = false;
    taken[next] = true;
    flock.spot = next;
    flock.flying = true;
    for (const p of flock.members) {
      p.from.copy(p.pos);
      spotPoint(spots[next], chance, p.to);
      const d = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
      p.t = 0;
      p.delay = chance() * 0.35;
      p.duration = clamp(d / 7, 2.2, 6) + chance() * 0.4;
      p.height = Math.min(3 + d * 0.12, 10) + chance();
      p.wander.x = p.to.x;
      p.wander.z = p.to.z;
    }
  }

  function scared(flock: Flock, player: XZ, speed: number, walkers: readonly { pos: XZ }[]) {
    for (const p of flock.members) {
      if (shouldFlee(Math.hypot(p.pos.x - player.x, p.pos.z - player.z), speed)) return true;
      for (const w of walkers) if (Math.hypot(p.pos.x - w.pos.x, p.pos.z - w.pos.z) < WALKER_SCARE) return true;
    }
    return false;
  }

  function peckAbout(p: Pigeon, spot: Spot, dt: number) {
    p.wanderTimer -= dt;
    if (p.wanderTimer <= 0) {
      p.wanderTimer = 2 + chance() * 4;
      p.wander.x = spot.x + (chance() * 2 - 1) * spot.rx;
      p.wander.z = spot.z + (chance() * 2 - 1) * spot.rz;
    }
    const dx = p.wander.x - p.pos.x;
    const dz = p.wander.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const step = Math.min(d, WANDER_SPEED * dt);
      p.pos.x += (dx / d) * step;
      p.pos.z += (dz / d) * step;
      p.yaw += Math.atan2(Math.sin(Math.atan2(dx, dz) - p.yaw), Math.cos(Math.atan2(dx, dz) - p.yaw)) * damp(6, dt);
      colliders.resolve(p.pos, RADIUS);
    }
    p.pos.y = groundHeight(p.pos.x);
    return d > 0.05;
  }

  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const bodyM = new THREE.Matrix4();
  const partM = new THREE.Matrix4();
  const outM = new THREE.Matrix4();

  function draw(i: number, p: Pigeon, pitch: number, flap: number | null) {
    q.setFromAxisAngle(UP, p.yaw);
    bodyM.compose(p.pos, q, one);
    // Tilt around the body's middle, not the feet.
    partM.makeRotationX(pitch).setPosition(0, PECK_PIVOT * (1 - Math.cos(pitch)), -PECK_PIVOT * Math.sin(pitch));
    bodies.setMatrixAt(i, outM.multiplyMatrices(bodyM, partM));
    if (flap === null) {
      wings.setMatrixAt(i * 2, HIDDEN);
      wings.setMatrixAt(i * 2 + 1, HIDDEN);
      return;
    }
    partM.makeRotationZ(flap).setPosition(WING.x, WING.y, WING.z);
    wings.setMatrixAt(i * 2, outM.multiplyMatrices(bodyM, partM));
    partM.makeRotationZ(Math.PI - flap).setPosition(-WING.x, WING.y, WING.z);
    wings.setMatrixAt(i * 2 + 1, outM.multiplyMatrices(bodyM, partM));
  }

  return {
    flocks,

    update(dt: number, t: number, player: XZ, speed: number, walkers: readonly { pos: XZ }[]) {
      let i = 0;
      for (const flock of flocks) {
        if (!flock.flying && scared(flock, player, speed, walkers)) takeOff(flock, player);
        let airborne = false;
        for (const p of flock.members) {
          if (p.t < 1) {
            if (p.delay > 0) p.delay -= dt;
            else p.t = Math.min(1, p.t + dt / p.duration);
            arcPoint(p.from, p.to, p.t, p.height, p.pos);
            const heading = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z);
            p.yaw += Math.atan2(Math.sin(heading - p.yaw), Math.cos(heading - p.yaw)) * damp(10, dt);
            // Beating hard on take-off, gliding in to land.
            const flap = p.t > 0.8 ? 0.5 : Math.sin(t * 30 + i) * 0.9;
            draw(i, p, -0.15, flap);
            airborne = true;
          } else {
            const walking = peckAbout(p, spots[flock.spot], dt);
            p.peck += dt * (walking ? 0 : 1);
            const nod = walking ? Math.abs(Math.sin(t * 9 + i)) * 0.15 : Math.max(0, Math.sin(p.peck * 4)) ** 6 * 0.8;
            draw(i, p, nod, null);
          }
          i++;
        }
        flock.flying = airborne;
      }
      bodies.instanceMatrix.needsUpdate = true;
      wings.instanceMatrix.needsUpdate = true;
    },
  };
}
