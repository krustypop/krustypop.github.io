import * as THREE from 'three';
import type { AtmosphereState } from './index.ts';

const SHADOW_SIZE = 2048;
const SHADOW_EXTENT = 40; // half-width of the shadowed square around the player
const SHADOW_TEXEL = (SHADOW_EXTENT * 2) / SHADOW_SIZE;
const LIGHT_DISTANCE = 60;
const SUN_INTENSITY = 2.6;
const MOON_INTENSITY = 0.5;
const LANTERN_INTENSITY = 18;
const ORIGIN = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const lightBasis = new THREE.Matrix4();
const lightBasisInv = new THREE.Matrix4();

// Moves the shadow frustum by whole texels only, so shadows don't shimmer while walking.
function snapToShadowTexel(p: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3) {
  lightBasis.lookAt(dir, ORIGIN, UP);
  lightBasisInv.copy(lightBasis).transpose();
  out.copy(p).applyMatrix4(lightBasisInv);
  out.x = Math.round(out.x / SHADOW_TEXEL) * SHADOW_TEXEL;
  out.y = Math.round(out.y / SHADOW_TEXEL) * SHADOW_TEXEL;
  return out.applyMatrix4(lightBasis);
}

/** One shadow-casting key light (sun by day, moon by night), a sky fill, and a lantern on the hero. */
export function createLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
  Object.assign(key.shadow.camera, {
    left: -SHADOW_EXTENT,
    right: SHADOW_EXTENT,
    top: SHADOW_EXTENT,
    bottom: -SHADOW_EXTENT,
    near: 1,
    far: 150,
  });
  // ~1.5 texels along the normal: removes acne on flat ground at grazing sun angles.
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.06;
  // Keeps the hero readable at night.
  const lantern = new THREE.PointLight('#ffd9a0', 0, 14, 2);
  scene.add(hemi, key, key.target, lantern);

  const shadowCenter = new THREE.Vector3();

  return {
    update({ palette, keyLight }: AtmosphereState, playerPos: THREE.Vector3, camera: THREE.Camera) {
      key.color.copy(keyLight.color);
      key.intensity = (keyLight.bySun ? SUN_INTENSITY : MOON_INTENSITY) * keyLight.strength;
      snapToShadowTexel(playerPos, keyLight.dir, shadowCenter);
      key.target.position.copy(shadowCenter);
      key.position.copy(shadowCenter).addScaledVector(keyLight.dir, LIGHT_DISTANCE);

      hemi.color.copy(palette.hemiSky);
      hemi.groundColor.copy(palette.hemiGround);
      hemi.intensity = palette.hemi;

      // Between the hero and the camera, so it lights the side we see.
      lantern.position.lerpVectors(playerPos, camera.position, 0.3);
      lantern.position.y = playerPos.y + 2.6;
      lantern.intensity = LANTERN_INTENSITY * palette.night;
    },
  };
}
