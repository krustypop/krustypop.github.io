import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { unitBox } from '../gfx/voxel.ts';
import type { Rand } from './types.ts';

const COUNT = 16;
const WRAP_X = 120;

// Each cloud is one merged mesh drifting along +X, wrapping around.
export function createClouds(
  scene: THREE.Object3D,
  { rand, material, zMin, zMax }: { rand: Rand; material: THREE.Material; zMin: number; zMax: number },
) {
  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < COUNT; i++) {
    const puffs = 3 + Math.floor(rand() * 3);
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < puffs; k++) {
      const s = 4 + rand() * 5;
      const y = rand() * 1.5;
      const z = (rand() - 0.5) * 4;
      parts.push(
        unitBox
          .clone()
          .scale(s * 1.6, s * 0.6, s)
          .translate(k * 4 - puffs * 2, y, z),
      );
    }
    const cloud = new THREE.Mesh(mergeGeometries(parts), material);
    cloud.position.set((rand() - 0.5) * 220, 38 + rand() * 18, zMin + rand() * (zMax - zMin));
    cloud.userData.speed = 0.6 + rand() * 1.2;
    cloud.userData.dynamic = true;
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    update(dt: number) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > WRAP_X) c.position.x = -WRAP_X;
      }
    },
  };
}
