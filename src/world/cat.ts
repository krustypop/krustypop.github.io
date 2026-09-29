import * as THREE from 'three';
import { box, coloredBlocks } from '../gfx/voxel.ts';
import { damp } from '../utils/math.ts';
import type { Colliders } from './collision.ts';
import { groundHeight } from './layout.ts';
import { CAT, createCatBrain, stepCat } from './life.ts';
import type { XZ } from './types.ts';

const FUR = '#d8843a';
const STRIPE = '#a85a22';
const CREAM = '#f3e3c8';
const PINK = '#e89a9a';
const EYE = '#7fd14a';
const LEDGE = '#9e9788'; // the flower-bed stone: merges into an existing draw call
const RADIUS = 0.25;
const TROT = 3.2;
const GALLOP = 7; // catching up with a running player
const HOME_REACH = 0.7; // close enough to hop back onto the ledge
const LEG = { reach: 0.07, lift: 0.05, stride: 9 };

// Awake cat facing +Z, feet at y = 0.
const BODY = coloredBlocks([
  [FUR, [0.26, 0.22, 0.58], [0, 0.35, 0]],
  [CREAM, [0.2, 0.06, 0.4], [0, 0.23, 0.04]],
  [STRIPE, [0.27, 0.05, 0.08], [0, 0.44, -0.14]],
  [STRIPE, [0.27, 0.05, 0.08], [0, 0.44, 0.02]],
  [STRIPE, [0.27, 0.05, 0.08], [0, 0.44, 0.18]],
  [FUR, [0.26, 0.24, 0.24], [0, 0.52, 0.36]],
  [CREAM, [0.14, 0.08, 0.04], [0, 0.44, 0.48]],
  [PINK, [0.05, 0.04, 0.03], [0, 0.49, 0.49]],
  [EYE, [0.05, 0.05, 0.02], [-0.07, 0.56, 0.485]],
  [EYE, [0.05, 0.05, 0.02], [0.07, 0.56, 0.485]],
  [FUR, [0.07, 0.1, 0.06], [-0.08, 0.68, 0.34]],
  [FUR, [0.07, 0.1, 0.06], [0.08, 0.68, 0.34]],
  [FUR, [0.07, 0.07, 0.26], [0, 0.42, -0.4]],
  [STRIPE, [0.07, 0.3, 0.07], [0, 0.6, -0.5]],
]);
// One diagonal pair of legs: front left and back right (the other pair is its mirror).
const legPair = (sx: number) =>
  coloredBlocks([
    [FUR, [0.08, 0.24, 0.08], [sx * 0.08, 0.14, 0.22]],
    [CREAM, [0.09, 0.04, 0.1], [sx * 0.08, 0.02, 0.23]],
    [FUR, [0.08, 0.24, 0.08], [-sx * 0.08, 0.14, -0.2]],
    [CREAM, [0.09, 0.04, 0.1], [-sx * 0.08, 0.02, -0.19]],
  ]);
// Curled up asleep: a loaf, the head tucked on the paws, the tail wrapped around the front.
const CURLED = coloredBlocks([
  [FUR, [0.44, 0.2, 0.4], [0, 0.1, 0]],
  [STRIPE, [0.45, 0.05, 0.08], [0, 0.18, -0.08]],
  [STRIPE, [0.45, 0.05, 0.08], [0, 0.18, 0.08]],
  [FUR, [0.24, 0.18, 0.22], [0.1, 0.13, 0.2]],
  [STRIPE, [0.12, 0.02, 0.02], [0.1, 0.15, 0.315]], // closed eyes
  [FUR, [0.06, 0.08, 0.06], [0.03, 0.26, 0.22]],
  [FUR, [0.06, 0.08, 0.06], [0.17, 0.26, 0.22]],
  [STRIPE, [0.46, 0.07, 0.08], [-0.02, 0.04, 0.26]],
]);

/**
 * A ginger cat napping on a window ledge. It wakes when the player comes by, stretches,
 * tags along for a while, then trots home and curls up again.
 */
export function createCat(
  scene: THREE.Object3D,
  { colliders, home, facade }: { colliders: Colliders; home: XZ; facade: number },
) {
  const side = Math.sign(home.x);
  const perchY = 0.75;
  // Static stone sill under the shop window, merged with the city.
  const ledge = new THREE.Group();
  box(ledge, LEDGE, [0.5, 0.1, 1.9], [0, perchY - 0.05, 0]);
  for (const dz of [-0.7, 0.7]) box(ledge, LEDGE, [0.14, 0.18, 0.12], [side * 0.14, perchY - 0.19, dz]);
  ledge.position.set(side * (facade - 0.26), 0, home.z);
  scene.add(ledge);

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const mesh = (g: THREE.BufferGeometry, shadow = true) => {
    const m = new THREE.Mesh(g, material);
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
  };
  const root = new THREE.Group();
  root.userData.dynamic = true;
  const curled = mesh(CURLED);
  const body = new THREE.Group();
  const trunk = mesh(BODY);
  const legs = [mesh(legPair(-1), false), mesh(legPair(1), false)];
  body.add(trunk, ...legs);
  root.add(curled, body);
  scene.add(root);

  const perch = { x: side * (facade - 0.38), z: home.z }; // the loaf clears the shop glass
  const foot = { x: side * (facade - 0.9), z: home.z }; // on the sidewalk below the ledge
  const pos = new THREE.Vector3(perch.x, perchY, perch.z);
  const brain = createCatBrain();
  const restYaw = side > 0 ? 0 : Math.PI; // asleep along the wall
  let yaw = restYaw;
  let phase = 0;
  let speed = 0;
  const goal = { x: 0, z: 0 };
  root.position.copy(pos);
  body.visible = false;

  const distTo = (p: XZ) => Math.hypot(p.x - pos.x, p.z - pos.z);

  return {
    brain,
    get pos() {
      return pos;
    },

    update(dt: number, t: number, player: XZ) {
      const atHome = distTo(perch) < 0.05 && pos.y > perchY - 0.05;
      const mode = stepCat(brain, dt, distTo(player), atHome);

      let targetY = groundHeight(pos.x);
      let want = 0;
      if (mode === 'follow') {
        // Keep a couple of meters away, on the cat's side of the player.
        const d = Math.max(distTo(player), 1e-3);
        goal.x = player.x + ((pos.x - player.x) / d) * CAT.keep;
        goal.z = player.z + ((pos.z - player.z) / d) * CAT.keep;
        const gap = distTo(goal);
        want = gap < 0.25 ? 0 : Math.min(gap * 2, d > 8 ? GALLOP : TROT);
      } else if (mode === 'return') {
        const back = distTo(foot) < HOME_REACH || distTo(perch) < HOME_REACH;
        goal.x = back ? perch.x : foot.x;
        goal.z = back ? perch.z : foot.z;
        want = Math.min(distTo(goal) * 3, TROT);
        if (back) targetY = perchY;
      } else targetY = perchY;
      speed += (want - speed) * damp(6, dt);

      if (speed > 0.01) {
        const dx = goal.x - pos.x;
        const dz = goal.z - pos.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, speed * dt);
        if (d > 1e-3) {
          pos.x += (dx / d) * step;
          pos.z += (dz / d) * step;
          const heading = Math.atan2(dx, dz);
          yaw += Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw)) * damp(8, dt);
        }
        if (targetY < perchY - 0.1 && distTo(perch) > HOME_REACH) colliders.resolve(pos, RADIUS);
        phase += step * LEG.stride;
      } else if (mode === 'follow') {
        // Waiting: look at the player.
        const heading = Math.atan2(player.x - pos.x, player.z - pos.z);
        yaw += Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw)) * damp(4, dt);
      }
      pos.y += (targetY - pos.y) * damp(12, dt);

      const asleep = mode === 'sleep';
      curled.visible = asleep;
      body.visible = !asleep;
      root.position.copy(pos);
      root.rotation.y = yaw;
      if (asleep) {
        yaw += Math.atan2(Math.sin(restYaw - yaw), Math.cos(restYaw - yaw)) * damp(3, dt);
        curled.scale.y = 1 + Math.sin(t * 1.6) * 0.04; // breathing
        return;
      }
      // Stretch: front down and long, then back up.
      const s = mode === 'wake' ? Math.sin((Math.PI * (CAT.stretch - brain.timer)) / CAT.stretch) : 0;
      body.rotation.x = s * 0.35;
      body.scale.z = 1 + s * 0.15;
      const gait = Math.min(1, speed / TROT);
      for (let k = 0; k < 2; k++) {
        const swing = Math.sin(phase + k * Math.PI) * gait;
        legs[k].position.z = swing * LEG.reach;
        legs[k].position.y = Math.max(0, swing) * LEG.lift;
      }
      trunk.position.y = Math.abs(Math.sin(phase)) * 0.02 * gait;
    },
  };
}
