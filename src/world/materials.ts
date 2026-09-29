import * as THREE from 'three';

// [day, night] colors, blended by the `night` factor.
type ColorPair = [THREE.Color, THREE.Color];

const WINDOW_LIT: ColorPair = [new THREE.Color('#6f8fb3'), new THREE.Color('#ffc65a')];
const WINDOW_DARK: ColorPair = [new THREE.Color('#44607e'), new THREE.Color('#1b2535')];
const LAMP_BULB: ColorPair = [new THREE.Color('#d9d4c4'), new THREE.Color('#fff0c0')];
const NIGHT_EPSILON = 0.001;

export interface CityMaterials {
  shopGlass: THREE.MeshStandardMaterial;
  lampBulb: THREE.MeshBasicMaterial;
  windowLit: THREE.MeshBasicMaterial;
  windowDark: THREE.MeshBasicMaterial;
  sill: THREE.MeshStandardMaterial;
  cloud: THREE.MeshLambertMaterial;
  dimAtNight: <M extends THREE.MeshBasicMaterial>(material: M) => M;
  setNight: (night: number) => void;
}

/** Materials that react to the time of day, shared by every building, lamp and cloud. */
export function createCityMaterials(): CityMaterials {
  const dimmed: THREE.MeshBasicMaterial[] = [];
  let lastNight = -1;

  const mats: CityMaterials = {
    shopGlass: new THREE.MeshStandardMaterial({
      color: '#8fb9d6',
      roughness: 0.2,
      metalness: 0.3,
      emissive: '#ffc46b',
      emissiveIntensity: 0,
    }),
    lampBulb: new THREE.MeshBasicMaterial(),
    windowLit: new THREE.MeshBasicMaterial(),
    windowDark: new THREE.MeshBasicMaterial(),
    // White so per-instance trim colors show through unchanged.
    sill: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
    cloud: new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#1c2548', emissiveIntensity: 0 }),

    // Self-lit (MeshBasic) ground markings that should fade at night instead of glowing.
    dimAtNight<M extends THREE.MeshBasicMaterial>(material: M) {
      dimmed.push(material);
      return material;
    },

    setNight(night: number) {
      if (Math.abs(night - lastNight) < NIGHT_EPSILON) return;
      lastNight = night;
      mats.windowLit.color.lerpColors(...WINDOW_LIT, night);
      mats.windowDark.color.lerpColors(...WINDOW_DARK, night);
      mats.lampBulb.color.lerpColors(...LAMP_BULB, night);
      mats.shopGlass.emissiveIntensity = night * 0.9;
      mats.cloud.emissiveIntensity = night;
      for (const m of dimmed) m.color.setScalar(1 - 0.6 * night);
    },
  };
  return mats;
}
