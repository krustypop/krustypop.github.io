import * as THREE from 'three';

// Palette keyframes by hour; `night` drives windows, lamps and stars.
// prettier-ignore
export const KEYS = [
  { h: 0, top: '#040817', horizon: '#141c33', sun: '#ff9a5a', hemiSky: '#34457a', hemiGround: '#0e1219', hemi: 0.55, density: 0.04, haze: 0.0045, night: 1 },
  { h: 5, top: '#121a40', horizon: '#4a4468', sun: '#ff9a5a', hemiSky: '#4a4a80', hemiGround: '#14161e', hemi: 0.6, density: 0.055, haze: 0.005, night: 0.95 },
  { h: 6.3, top: '#4f74b8', horizon: '#ffb08a', sun: '#ffae70', hemiSky: '#c8b8d8', hemiGround: '#5f6a55', hemi: 1.0, density: 0.055, haze: 0.005, night: 0.3 },
  { h: 8.5, top: '#6fb3e8', horizon: '#ffe1bd', sun: '#ffe9c9', hemiSky: '#dcecff', hemiGround: '#8a9a6a', hemi: 1.5, density: 0.03, haze: 0.005, night: 0 },
  { h: 12.5, top: '#4a9be0', horizon: '#d4e9f7', sun: '#fff6e8', hemiSky: '#dcecff', hemiGround: '#8a9a6a', hemi: 1.7, density: 0.012, haze: 0.0035, night: 0 },
  { h: 16, top: '#5fa6e2', horizon: '#ffe4c4', sun: '#ffe2b8', hemiSky: '#dcecff', hemiGround: '#8a9a6a', hemi: 1.5, density: 0.02, haze: 0.0045, night: 0 },
  { h: 18.2, top: '#3b5596', horizon: '#ff9565', sun: '#ff8a4a', hemiSky: '#d8a8b0', hemiGround: '#5e5a4a', hemi: 1.0, density: 0.03, haze: 0.0045, night: 0.35 },
  { h: 19.4, top: '#18204e', horizon: '#6a3f63', sun: '#ff7a4a', hemiSky: '#5a5a90', hemiGround: '#1a1a22', hemi: 0.65, density: 0.04, haze: 0.005, night: 0.85 },
].map((k) => ({
  ...k,
  top: new THREE.Color(k.top),
  horizon: new THREE.Color(k.horizon),
  sun: new THREE.Color(k.sun),
  hemiSky: new THREE.Color(k.hemiSky),
  hemiGround: new THREE.Color(k.hemiGround),
}));
KEYS.push({ ...KEYS[0], h: 24 });

const COLOR_KEYS = ['top', 'horizon', 'sun', 'hemiSky', 'hemiGround'] as const;
const NUMBER_KEYS = ['hemi', 'density', 'haze', 'night'] as const;

export type Palette = Record<(typeof COLOR_KEYS)[number], THREE.Color> & Record<(typeof NUMBER_KEYS)[number], number>;

export function createPalette(): Palette {
  const palette = {} as Palette;
  for (const k of COLOR_KEYS) palette[k] = new THREE.Color();
  return palette;
}

/** Blends the two keyframes around `hour` (0 ≤ hour < 24) into `out`. */
export function samplePalette(hour: number, out: Palette) {
  const i = KEYS.findIndex((k) => k.h > hour);
  const a = KEYS[i - 1];
  const b = KEYS[i];
  const t = (hour - a.h) / (b.h - a.h);
  for (const k of COLOR_KEYS) out[k].lerpColors(a[k], b[k], t);
  for (const k of NUMBER_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}
