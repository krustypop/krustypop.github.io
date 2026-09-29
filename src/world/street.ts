import * as THREE from 'three';
import { box, solid } from '../gfx/voxel.ts';
import { crosswalkStripeXs, type Layout, ROAD_HALF, SIDEWALK_Y, WALK_HALF } from './layout.ts';

const PAINT = '#f2efe6';
const CURB_HEIGHT = SIDEWALK_Y + 0.05;

export function buildStreet(scene: THREE.Object3D, layout: Layout) {
  const { length, midZ } = layout.street;

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, length + 400), solid('#78b35a'));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.02, midZ);
  grass.receiveShadow = true;
  scene.add(grass);

  box(scene, '#3b4048', [ROAD_HALF * 2, 0.1, length], [0, -0.05, midZ]);
  for (const s of [-1, 1]) {
    const sidewalkX = (s * (ROAD_HALF + WALK_HALF)) / 2;
    box(scene, '#cfc8bb', [WALK_HALF - ROAD_HALF, SIDEWALK_Y, length], [sidewalkX, SIDEWALK_Y / 2, midZ]);
    // Pokes slightly past the sidewalk's faces so they are never coplanar (z-fighting).
    box(scene, '#9e9788', [0.3, CURB_HEIGHT, length + 0.04], [s * (ROAD_HALF + 0.13), CURB_HEIGHT / 2, midZ]);
  }

  const paint = { shadow: false };
  for (const z of layout.dashZs) box(scene, PAINT, [0.25, 0.02, 2.6], [0, 0.01, z], paint);
  for (const z of layout.crosswalkZs) {
    for (const x of crosswalkStripeXs) box(scene, PAINT, [0.8, 0.02, 3], [x, 0.01, z], paint);
  }
}
