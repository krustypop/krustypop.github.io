import * as THREE from 'three';
import { coloredBlocks } from '../gfx/voxel.ts';
import { damp } from '../utils/math.ts';
import type { PlayerState } from './controller.ts';
import { createPose, DANCE_DURATION, heroPose, LOOK_DURATION, type PoseClock } from './poses.ts';

type Blocks = Parameters<typeof coloredBlocks>[0];

export interface Outfit {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const EYES = '#1b1b1b';
const HIP_Y = 0.85;
const SHOULDER_Y = 1.75;
const NECK_Y = 1.8;
const YAW_RATE = 18; // head turns stay brisk even while an idle clip eases in
const STILL_SPEED = 0.1;

function part(blocks: Blocks) {
  const mesh = new THREE.Mesh(coloredBlocks(blocks), material);
  mesh.castShadow = true;
  return mesh;
}

// Limbs rotate around a pivot at the hip / shoulder / neck.
function limb(x: number, y: number, blocks: Blocks) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  pivot.add(part(blocks));
  return pivot;
}

/** Voxel hero facing local +Z; `update` mirrors the player state and plays walk, idle and dance poses. */
export function createCharacter({ skin, hair, shirt, pants, shoes }: Outfit) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  body.add(part([[shirt, [0.8, 0.95, 0.46], [0, 1.32, 0]]]));
  const head = limb(0, NECK_Y, [
    [skin, [0.7, 0.7, 0.7], [0, 0.35, 0]],
    [hair, [0.76, 0.22, 0.76], [0, 0.73, 0]],
    [hair, [0.76, 0.5, 0.16], [0, 0.5, -0.31]],
    [EYES, [0.1, 0.12, 0.04], [-0.16, 0.4, 0.36]],
    [EYES, [0.1, 0.12, 0.04], [0.16, 0.4, 0.36]],
  ]);
  head.rotation.order = 'YXZ'; // yaw, then nod in the turned frame
  const legs = [-0.2, 0.2].map((x) =>
    limb(x, HIP_Y, [
      [pants, [0.36, 0.78, 0.4], [0, -0.39, 0]],
      [shoes, [0.38, 0.14, 0.5], [0, -0.78, 0.04]],
    ]),
  );
  const arms = [-0.55, 0.55].map((x) =>
    limb(x, SHOULDER_Y, [
      [shirt, [0.28, 0.72, 0.3], [0, -0.36, 0]],
      [skin, [0.26, 0.2, 0.28], [0, -0.8, 0]],
    ]),
  );
  // Lies on the back of the +X hand: with the arm raised forward, local +Z points up at the face.
  const phone = part([
    ['#16181d', [0.2, 0.32, 0.05], [0, 0, 0]],
    ['#8fd6ff', [0.16, 0.26, 0.02], [0, 0, 0.035]],
  ]);
  phone.position.set(0, -0.86, 0.17);
  phone.visible = false;
  arms[1].add(phone);
  body.add(head, ...legs, ...arms);

  const joints = [...legs, ...arms];
  const pose = createPose();
  const clock: PoseClock = { still: 0, look: LOOK_DURATION, dance: DANCE_DURATION };
  let lastHeading = Number.NaN;

  return {
    root,

    // Left, right, left: fired at the curb, facing a crosswalk.
    lookBothWays() {
      clock.look = 0;
    },

    celebrate() {
      clock.dance = 0;
    },

    update(state: PlayerState, dt: number) {
      const { pos, heading, speed, grounded, seated } = state;
      root.position.copy(pos);
      root.rotation.y = heading;

      // Turning on the spot counts as moving.
      const still = grounded && !seated && Math.abs(speed) < STILL_SPEED && heading === lastHeading;
      lastHeading = heading;
      clock.still = still ? clock.still + dt : 0;
      clock.look += dt;
      clock.dance += dt;
      heroPose(state, clock, pose);

      const k = damp(pose.rate, dt);
      for (let i = 0; i < joints.length; i++) joints[i].rotation.x += (pose.swing[i] - joints[i].rotation.x) * k;
      arms[0].rotation.z += (-pose.spread[0] - arms[0].rotation.z) * k;
      arms[1].rotation.z += (pose.spread[1] - arms[1].rotation.z) * k;
      head.rotation.x += (pose.headPitch - head.rotation.x) * k;
      head.rotation.y += (pose.headYaw - head.rotation.y) * damp(YAW_RATE, dt);
      phone.visible = pose.phone;
      body.position.y = pose.hop;
    },
  };
}
