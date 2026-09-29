import * as THREE from 'three';
import { type ColoredBlock, coloredBlocks, instanced } from '../gfx/voxel.ts';
import { clamp, damp } from '../utils/math.ts';
import { pick, rng } from '../utils/random.ts';
import type { Colliders } from './collision.ts';
import { groundHeight, ROAD_HALF } from './layout.ts';
import { maySit, mustLeave, personalSpace, turnAround } from './life.ts';
import type { XZ } from './types.ts';

const COUNT = 8;
const SEED = 5147; // own streams: passers-by never shift the city
const RADIUS = 0.3;
const LANE_X = 7.45; // between the curb lamps and the trees, benches and flower beds
const CURB = ROAD_HALF + 0.2;
const DETOURS = [0, 0.9, 1.8]; // roadward steps around a prop: along the curb, then onto the road edge
const ROAD_EDGE = ROAD_HALF - 0.5;
const PLAYER_SPACE = 2.4;
const CROWD_SPACE = 1.1;
const SIT_CHANCE = 0.4;
const MAX_SEATED = 2;
const SIT_TIME = [15, 25]; // min, extra
const FRONT = 0.85; // where a sitter stands before sitting down
const HIP_Y = 0.82;
const SHOULDER = { x: 0.47, y: 1.68 };
const SEAT_DROP = 0.65; // hip minus half a thigh
const STRIDE = 2.4; // walk-cycle radians per meter
const SWING = 0.6;
const SEATED_POSE = { leg: -1.45, arm: -0.45 };
const W = '#ffffff'; // tinted per instance
const EYES = '#1b1b1b';

const SKINS = ['#f6d7bf', '#f1c9a5', '#e0ac85', '#c68d63', '#8d5a3b', '#5e3b26'];
const HAIRS = ['#2b1e16', '#5a3a22', '#a8743c', '#d9b76a', '#1a1a1a', '#8a8a8a', '#b5462a'];
const SHIRTS = ['#d94f4f', '#3f7fd9', '#f2c14e', '#4fa36b', '#8e5ad9', '#f28c3a', '#e9e4d8', '#2f3b52', '#e46aa0'];
const PANTS = ['#2f3b52', '#3d4b63', '#6b5540', '#1e1f24', '#8a8f99', '#a8845a'];
const SHOES = ['#1e1f24', '#f2f2f2', '#6b3e26', '#c94040'];
const HATS = ['#c94040', '#2f3b52', '#e2c46a', '#4fa36b'];
const BAGS = ['#6b4a2e', '#3f7fd9', '#d9a441', '#2f3b52'];

type Mode = 'walk' | 'cross' | 'toBench' | 'sit' | 'leave';
type Slot = 'skin' | 'hair' | 'shirt' | 'pants' | 'shoes' | 'hat' | 'bag';

interface Walker {
  pos: THREE.Vector3;
  yaw: number;
  dir: -1 | 1;
  side: -1 | 1;
  lane: number;
  speed: number;
  scale: number;
  phase: number;
  gait: number; // 0 standing, 1 full stride
  seated: number; // 0 standing, 1 seated pose
  mode: Mode;
  bench: number;
  lastBench: number;
  timer: number;
  stuck: number;
  detour: number;
  level: number;
  look: Record<Slot, THREE.Color | null>;
}

export interface BenchSeat {
  seat: XZ;
  seatY: number;
  heading: number;
}

interface Part {
  joint: 'body' | 'leg' | 'arm';
  slot: Slot;
  shadow: boolean;
  blocks: ColoredBlock[];
}

// Body parts in their joint's space, split by tint so one instanced mesh draws a part for everyone.
const PARTS: Part[] = [
  { joint: 'body', slot: 'shirt', shadow: true, blocks: [[W, [0.72, 0.88, 0.42], [0, 1.3, 0]]] },
  {
    joint: 'body',
    slot: 'skin',
    shadow: true,
    blocks: [
      [W, [0.62, 0.62, 0.62], [0, 2.05, 0]],
      [EYES, [0.09, 0.1, 0.04], [-0.14, 2.1, 0.32]],
      [EYES, [0.09, 0.1, 0.04], [0.14, 2.1, 0.32]],
    ],
  },
  {
    joint: 'body',
    slot: 'hair',
    shadow: false,
    blocks: [
      [W, [0.66, 0.18, 0.66], [0, 2.42, 0]],
      [W, [0.66, 0.44, 0.14], [0, 2.2, -0.27]],
    ],
  },
  {
    joint: 'body',
    slot: 'hat',
    shadow: false,
    blocks: [
      [W, [0.8, 0.07, 0.86], [0, 2.4, 0.05]],
      [W, [0.58, 0.3, 0.58], [0, 2.58, 0]],
    ],
  },
  {
    joint: 'body',
    slot: 'bag',
    shadow: false,
    blocks: [
      [W, [0.5, 0.6, 0.22], [0, 1.38, -0.32]],
      [W, [0.08, 0.06, 0.46], [-0.22, 1.73, -0.02]],
      [W, [0.08, 0.06, 0.46], [0.22, 1.73, -0.02]],
    ],
  },
  { joint: 'leg', slot: 'pants', shadow: true, blocks: [[W, [0.3, 0.72, 0.34], [0, -0.36, 0]]] },
  { joint: 'leg', slot: 'shoes', shadow: false, blocks: [[W, [0.32, 0.12, 0.44], [0, -0.76, 0.04]]] },
  { joint: 'arm', slot: 'shirt', shadow: false, blocks: [[W, [0.22, 0.62, 0.26], [0, -0.31, 0]]] },
  { joint: 'arm', slot: 'skin', shadow: false, blocks: [[W, [0.2, 0.18, 0.22], [0, -0.71, 0]]] },
];

const UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Passers-by strolling both sidewalks; they step aside for the player and sometimes rest on a bench. */
export function createPedestrians(
  scene: THREE.Object3D,
  {
    colliders,
    benches,
    minZ,
    maxZ,
  }: { colliders: Colliders; benches: readonly BenchSeat[]; minZ: number; maxZ: number },
) {
  const rand = rng(SEED);
  const chance = rng(SEED + 1);
  const occupant = benches.map(() => -1);
  let seatedCount = 0;

  const walkers: Walker[] = Array.from({ length: COUNT }, (_, i): Walker => {
    const side = rand() < 0.5 ? -1 : 1;
    const dir = rand() < 0.5 ? -1 : 1;
    const lane = LANE_X + (rand() - 0.5) * 0.2;
    const z = maxZ - ((i + rand() * 0.8) / COUNT) * (maxZ - minZ);
    const look = {
      skin: new THREE.Color(pick(rand, SKINS)),
      hair: new THREE.Color(pick(rand, HAIRS)),
      shirt: new THREE.Color(pick(rand, SHIRTS)),
      pants: new THREE.Color(pick(rand, PANTS)),
      shoes: new THREE.Color(pick(rand, SHOES)),
      hat: rand() < 0.4 ? new THREE.Color(pick(rand, HATS)) : null,
      bag: rand() < 0.35 ? new THREE.Color(pick(rand, BAGS)) : null,
    };
    const pos = new THREE.Vector3(side * lane, 0, z);
    colliders.resolve(pos, RADIUS);
    pos.y = groundHeight(pos.x);
    return {
      pos,
      yaw: dir < 0 ? Math.PI : 0,
      dir,
      side,
      lane,
      speed: 1.2 + rand() * 0.8,
      scale: 0.88 + rand() * 0.16,
      phase: rand() * Math.PI * 2,
      gait: 1,
      seated: 0,
      mode: 'walk',
      bench: -1,
      lastBench: -1,
      timer: 0,
      stuck: 0,
      detour: 0,
      level: 0,
      look,
    };
  });

  const group = new THREE.Group();
  group.userData.dynamic = true;
  scene.add(group);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const meshes = PARTS.map(({ joint, slot, shadow, blocks }) => {
    const perWalker = joint === 'body' ? 1 : 2;
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    for (const w of walkers) {
      for (let k = 0; k < perWalker; k++) {
        matrices.push(w.look[slot] ? new THREE.Matrix4() : HIDDEN);
        colors.push(w.look[slot] ?? new THREE.Color());
      }
    }
    const mesh = instanced(group, coloredBlocks(blocks), material, matrices, colors);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    return mesh;
  });

  const push = { x: 0, z: 0 };
  const prev = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const bodyM = new THREE.Matrix4();
  const jointM = new THREE.Matrix4();
  const limbM = new THREE.Matrix4();

  const frontOf = (b: BenchSeat, out: XZ) => {
    out.x = b.seat.x + Math.sin(b.heading) * FRONT;
    out.z = b.seat.z + Math.cos(b.heading) * FRONT;
    return out;
  };
  const front = { x: 0, z: 0 };

  function freeBench(w: Walker) {
    occupant[w.bench] = -1;
    w.bench = -1;
    seatedCount--;
  }

  // Offered once per bench walked past: takes it if the dice, the bench and the player allow.
  function considerBench(w: Walker, i: number, player: XZ) {
    for (let k = 0; k < benches.length; k++) {
      const b = benches[k];
      if (k === w.lastBench || Math.sign(b.seat.x) !== w.side || Math.abs(w.pos.z - b.seat.z) > 1.2) continue;
      w.lastBench = k;
      const far = Math.hypot(player.x - b.seat.x, player.z - b.seat.z);
      if (seatedCount < MAX_SEATED && chance() < SIT_CHANCE && maySit(far, occupant[k] < 0)) {
        occupant[k] = i;
        seatedCount++;
        w.bench = k;
        w.mode = 'toBench';
      }
      return;
    }
  }

  function steerWalk(w: Walker, i: number, player: XZ, dt: number) {
    const was = w.dir;
    w.dir = turnAround(w.pos.z, w.dir, minZ, maxZ);
    if (w.dir !== was && chance() < 0.5) w.mode = 'cross';
    if (w.mode === 'walk') considerBench(w, i, player);

    const crossing = w.mode === 'cross';
    const laneX = crossing ? -w.side * w.lane : w.side * (w.lane - (w.detour > 0 ? DETOURS[w.level] : 0));
    let vx = crossing ? Math.sign(laneX - w.pos.x) * w.speed : clamp((laneX - w.pos.x) * 1.5, -0.8, 0.8);
    let vz = crossing ? 0 : w.dir * w.speed;

    const k = personalSpace(w.pos, player, PLAYER_SPACE, push);
    vx += push.x * 2.2;
    vz = vz * (1 - 0.6 * k) + push.z * 1.5;
    for (let j = 0; j < walkers.length; j++) {
      const o = walkers[j];
      if (j === i || o.mode === 'sit') continue;
      // Everyone steps to their own right, so two walkers meeting head-on pass each other.
      const c = personalSpace(w.pos, o.pos, CROWD_SPACE, push, i < j ? 1 : -1);
      vx += push.x * 1.2 + c * w.dir * 1.2;
      vz += push.z * 0.4;
    }

    w.pos.x += vx * dt;
    w.pos.z += vz * dt;
    colliders.resolve(w.pos, RADIUS);
    const curb = w.detour > 0 && w.level === DETOURS.length - 1 ? ROAD_EDGE : CURB;
    if (!crossing && Math.abs(w.pos.x) < curb) w.pos.x = w.side * curb;

    // Blocked head-on by a prop: step toward the road, off the curb if that is not enough.
    const progress = crossing ? Math.abs(w.pos.x - prev.x) : (w.pos.z - prev.z) * w.dir;
    w.stuck = progress < w.speed * dt * 0.3 && k < 0.05 ? w.stuck + dt : Math.max(0, w.stuck - dt);
    if (w.stuck > 0.5) {
      w.stuck = 0;
      const last = DETOURS.length - 1;
      // Walled in even on the road edge: give up and walk back.
      if (w.detour > 0 && w.level === last) {
        w.dir = w.dir < 0 ? 1 : -1;
        w.level = 0;
        w.detour = 0;
      } else {
        w.level = w.detour > 0 ? w.level + 1 : 1;
        w.detour = 1.5;
      }
    }
    w.detour = Math.max(0, w.detour - dt);

    if (crossing && Math.abs(w.pos.x - laneX) < 0.3) {
      w.side = w.side < 0 ? 1 : -1;
      w.mode = 'walk';
    }
  }

  function moveTo(w: Walker, target: XZ, dt: number) {
    const dx = target.x - w.pos.x;
    const dz = target.z - w.pos.z;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, w.speed * dt);
    if (d > 1e-4) {
      w.pos.x += (dx / d) * step;
      w.pos.z += (dz / d) * step;
    }
    return d - step;
  }

  function steerBench(w: Walker, player: XZ, dt: number) {
    const b = benches[w.bench];
    const near = Math.hypot(player.x - b.seat.x, player.z - b.seat.z);
    frontOf(b, front);
    if (w.mode === 'toBench') {
      if (mustLeave(near, 1)) w.mode = 'leave';
      else if (moveTo(w, front, dt) < 0.05) {
        w.mode = 'sit';
        w.timer = SIT_TIME[0] + chance() * SIT_TIME[1];
      }
    } else if (w.mode === 'sit') {
      const k = damp(8, dt);
      w.pos.x += (b.seat.x - w.pos.x) * k;
      w.pos.z += (b.seat.z - w.pos.z) * k;
      w.timer -= dt;
      if (mustLeave(near, w.timer)) w.mode = 'leave';
    } else {
      const k = damp(12, dt);
      w.pos.x += (front.x - w.pos.x) * k;
      w.pos.z += (front.z - w.pos.z) * k;
      if (Math.hypot(front.x - w.pos.x, front.z - w.pos.z) < 0.08 && w.seated < 0.1) {
        freeBench(w);
        w.mode = 'walk';
      }
    }
  }

  function pose(w: Walker, dt: number) {
    const sitting = w.mode === 'sit';
    const b = w.bench >= 0 ? benches[w.bench] : null;
    w.seated += ((sitting ? 1 : 0) - w.seated) * damp(sitting ? 6 : 14, dt);

    const moved = Math.hypot(w.pos.x - prev.x, w.pos.z - prev.z);
    const pace = dt > 0 ? moved / dt : 0;
    w.gait += (Math.min(1, pace / w.speed) - w.gait) * damp(8, dt);
    w.phase += (moved * STRIDE) / w.scale;
    if (sitting && b) w.yaw += angleTo(w.yaw, b.heading) * damp(8, dt);
    else if (pace > 0.2) w.yaw += angleTo(w.yaw, Math.atan2(w.pos.x - prev.x, w.pos.z - prev.z)) * damp(8, dt);

    const floor = groundHeight(w.pos.x);
    const seatY = b ? b.seatY - SEAT_DROP * w.scale : floor;
    w.pos.y = floor + (seatY - floor) * w.seated;
  }

  function draw(w: Walker, i: number) {
    const swing = Math.sin(w.phase) * SWING * w.gait * (1 - w.seated);
    const bob = Math.abs(Math.sin(w.phase)) * 0.05 * w.gait * (1 - w.seated);
    q.setFromAxisAngle(UP, w.yaw);
    bodyM.compose(lift.set(w.pos.x, w.pos.y + bob, w.pos.z), q, s.setScalar(w.scale));

    for (let p = 0; p < PARTS.length; p++) {
      const part = PARTS[p];
      if (!w.look[part.slot]) continue;
      const mesh = meshes[p];
      if (part.joint === 'body') {
        mesh.setMatrixAt(i, bodyM);
        continue;
      }
      for (let k = 0; k < 2; k++) {
        const sign = k === 0 ? -1 : 1;
        const leg = part.joint === 'leg';
        const seatedAngle = leg ? SEATED_POSE.leg : SEATED_POSE.arm;
        const walkAngle = (leg ? sign : -sign) * swing;
        jointM.makeRotationX(walkAngle + seatedAngle * w.seated);
        jointM.setPosition(leg ? sign * 0.16 : sign * SHOULDER.x, leg ? HIP_Y : SHOULDER.y, 0);
        mesh.setMatrixAt(i * 2 + k, limbM.multiplyMatrices(bodyM, jointM));
      }
    }
  }

  return {
    walkers,

    update(dt: number, player: XZ) {
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        prev.copy(w.pos);
        if (w.mode === 'walk' || w.mode === 'cross') steerWalk(w, i, player, dt);
        else steerBench(w, player, dt);
        pose(w, dt);
        draw(w, i);
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    },
  };
}
