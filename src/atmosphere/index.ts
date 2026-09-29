import * as THREE from 'three';
import { smoothstep } from '../utils/math.ts';
import { celestialDirections, createDayClock } from './clock.ts';
import { applyFog, updateFog } from './fog.ts';
import { createLights } from './lights.ts';
import { createPalette, type Palette, samplePalette } from './palette.ts';
import { createSky } from './sky.ts';

const MOON_COLOR = new THREE.Color('#9db4ff');
const MOON_SCATTER = 0.4; // moonlight glows less through the fog than sunlight
const SCATTER_MIX = 0.7;

export interface KeyLight {
  dir: THREE.Vector3;
  color: THREE.Color;
  strength: number;
  bySun: boolean;
}

export interface AtmosphereState {
  palette: Palette;
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  sunUp: number;
  keyLight: KeyLight;
}

/** What the rest of the game reads each frame. */
export interface Environment {
  hour: number;
  night: number;
}

const aboveHorizon = (dir: THREE.Vector3) => smoothstep(-0.03, 0.12, dir.y);

/** Time of day: sky, key light, fog and the `night` factor the rest of the game reacts to. */
export function createAtmosphere(scene: THREE.Scene) {
  const now = new Date();
  const clock = createDayClock(now.getHours() + now.getMinutes() / 60);
  const sky = createSky(scene);
  const lights = createLights(scene);

  const background = new THREE.Color();
  scene.background = background;
  // Only turns on USE_FOG and feeds fogColor; the fog's shape comes from fog.ts.
  const fog = new THREE.Fog(new THREE.Color(), 1, 1000);
  scene.fog = fog;

  const palette = createPalette();
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const scatterColor = new THREE.Color();
  const keyLight: KeyLight = { dir: sunDir, color: new THREE.Color(), strength: 0, bySun: true };
  const state: AtmosphereState = { palette, sunDir, moonDir, sunUp: 0, keyLight };

  return {
    applyFog,
    setHour: clock.set,
    skipToNextPhase: clock.skipToNextPhase,

    update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): Environment {
      const hour = clock.tick(dt);
      samplePalette(hour, palette);
      celestialDirections(hour, sunDir, moonDir);

      state.sunUp = aboveHorizon(sunDir);
      keyLight.bySun = sunDir.y >= moonDir.y;
      keyLight.dir = keyLight.bySun ? sunDir : moonDir;
      keyLight.color.copy(keyLight.bySun ? palette.sun : MOON_COLOR);
      keyLight.strength = keyLight.bySun ? state.sunUp : aboveHorizon(moonDir);

      lights.update(state, playerPos, camera);
      sky.update(dt, state, camera);
      fog.color.copy(palette.horizon);
      background.copy(palette.horizon);
      const scatter = SCATTER_MIX * keyLight.strength * (keyLight.bySun ? 1 : MOON_SCATTER);
      updateFog(dt, {
        lightDir: keyLight.dir,
        scatterColor: scatterColor.copy(palette.horizon).lerp(keyLight.color, scatter),
        density: palette.density,
        haze: palette.haze,
      });

      return { hour, night: palette.night };
    },
  };
}
