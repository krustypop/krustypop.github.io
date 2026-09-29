import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instanced } from '../gfx/voxel.ts';
import { rng } from '../utils/random.ts';
import { BUILDING } from './layout.ts';
import { lightsOut, lightsSchedule } from './life.ts';
import type { CityMaterials } from './materials.ts';
import type { Rand } from './types.ts';

const LIT_RATIO = 0.35;
const FRONT_COLUMNS = 4;
const SIDE_COLUMNS = 3;
const SILHOUETTE_RATIO = 0.3;
const SILHOUETTE_OUT = 0.155; // pane front face is at 0.13: clear of z-fighting
const HOUR_EPSILON = 0.01;
const NIGHT_EPSILON = 0.001;
// Day color matches the lit pane, so silhouettes only show once the room glows.
const SILHOUETTE: [THREE.Color, THREE.Color] = [new THREE.Color('#6f8fb3'), new THREE.Color('#2b1d14')];
const paneGeometry = new THREE.BoxGeometry(1.6, 1.8, 0.14);
const sillGeometry = new THREE.BoxGeometry(1.9, 0.16, 0.32);
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Flat shapes standing on the pane's bottom edge (y = -0.9), as [w, h, x, y] rectangles.
const SHAPES: [number, number, number, number][][] = [
  // someone at the window: shoulders, neck, head
  [
    [0.84, 0.5, 0, -0.65],
    [0.18, 0.1, 0, -0.35],
    [0.38, 0.44, 0, -0.08],
  ],
  // a potted plant
  [
    [0.36, 0.3, 0, -0.75],
    [0.08, 0.25, 0, -0.48],
    [0.5, 0.26, 0, -0.26],
    [0.3, 0.2, -0.16, -0.06],
    [0.26, 0.18, 0.16, 0.02],
  ],
  // a floor lamp
  [
    [0.36, 0.06, 0, -0.87],
    [0.06, 0.95, 0, -0.38],
    [0.52, 0.12, 0, 0.12],
    [0.4, 0.14, 0, 0.25],
  ],
];

const shapeGeometry = (rects: [number, number, number, number][]) =>
  mergeGeometries(rects.map(([w, h, x, y]) => new THREE.PlaneGeometry(w, h).translate(x, y, 0)));

interface Slot {
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
}

// A lit window that may switch off late at night, with its dark twin and optional silhouette.
interface LiveWindow {
  lit: number;
  dark: number;
  matrix: THREE.Matrix4;
  offAt: number;
  onAt: number;
  off: boolean;
  shape: number;
  shapeIndex: number;
  shapeMatrix: THREE.Matrix4 | null;
}

export interface WindowBatch {
  addBuilding: (buildingMatrix: THREE.Matrix4, floors: number, trim: THREE.Color, rand: Rand) => void;
  build: (parent: THREE.Object3D) => void;
  update: (hour: number, night: number) => void;
}

// Window slots in building space: facade on +Z, side walls on ±X.
function facadeSlots(floors: number) {
  const { width: W, depth: D, groundFloor, floor } = BUILDING;
  const slots: Slot[] = [];
  for (let f = 0; f < floors; f++) {
    const y = groundFloor + f * floor + floor * 0.55;
    for (let c = 0; c < FRONT_COLUMNS; c++) {
      slots.push({ x: -W / 2 + ((c + 0.5) * W) / FRONT_COLUMNS, y, z: D / 2, nx: 0, nz: 1 });
    }
    for (let c = 0; c < SIDE_COLUMNS; c++) {
      for (const s of [-1, 1])
        slots.push({ x: (s * W) / 2, y, z: -D / 2 + ((c + 0.5) * D) / SIDE_COLUMNS, nx: s, nz: 0 });
    }
  }
  return slots;
}

// Seeded by world position, so a window keeps its habits whatever order buildings are generated in.
const windowRand = (m: THREE.Matrix4) =>
  rng(
    (Math.round(m.elements[12] * 10) * 73856093) ^
      (Math.round(m.elements[13] * 10) * 19349663) ^
      (Math.round(m.elements[14] * 10) * 83492791),
  );

/** Collects every window of the city, then draws them all in a few instanced meshes. */
export function createWindowBatch(mats: CityMaterials): WindowBatch {
  const lit: THREE.Matrix4[] = [];
  const dark: THREE.Matrix4[] = [];
  const sills: THREE.Matrix4[] = [];
  const sillColors: THREE.Color[] = [];
  const live: LiveWindow[] = [];
  const shapeMatrices: THREE.Matrix4[][] = SHAPES.map(() => []);
  const local = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const silhouette = new THREE.MeshBasicMaterial({ color: SILHOUETTE[0] });
  let litMesh: THREE.InstancedMesh | null = null;
  let darkMesh: THREE.InstancedMesh | null = null;
  const shapeMeshes: THREE.InstancedMesh[] = [];
  let lastHour = -1;
  let lastNight = -1;

  const place = (buildingMatrix: THREE.Matrix4, x: number, y: number, z: number) =>
    local
      .compose(p.set(x, y, z), q, ONE)
      .premultiply(buildingMatrix)
      .clone();

  function addLive(buildingMatrix: THREE.Matrix4, s: Slot, matrix: THREE.Matrix4) {
    const r = windowRand(matrix);
    const { offAt, onAt } = lightsSchedule(r(), r());
    const w: LiveWindow = {
      lit: lit.length - 1,
      dark: -1,
      matrix,
      offAt,
      onAt,
      off: false,
      shape: -1,
      shapeIndex: -1,
      shapeMatrix: null,
    };
    if (r() < SILHOUETTE_RATIO) {
      w.shape = Math.floor(r() * SHAPES.length);
      const dx = (r() - 0.5) * 0.7; // along the facade
      // Planes face +Z: turn each one toward its wall's outward normal.
      q.setFromAxisAngle(UP, Math.atan2(s.nx, s.nz));
      const ox = s.nx ? 0 : dx;
      const oz = s.nx ? dx * -s.nx : 0;
      w.shapeMatrix = place(buildingMatrix, s.x + s.nx * SILHOUETTE_OUT + ox, s.y, s.z + s.nz * SILHOUETTE_OUT + oz);
      w.shapeIndex = shapeMatrices[w.shape].push(w.shapeMatrix) - 1;
    }
    live.push(w);
  }

  function apply(w: LiveWindow, off: boolean) {
    w.off = off;
    litMesh!.setMatrixAt(w.lit, off ? HIDDEN : w.matrix);
    darkMesh!.setMatrixAt(w.dark, off ? w.matrix : HIDDEN);
    if (w.shapeMatrix) shapeMeshes[w.shape].setMatrixAt(w.shapeIndex, off ? HIDDEN : w.shapeMatrix);
  }

  return {
    addBuilding(buildingMatrix: THREE.Matrix4, floors: number, trim: THREE.Color, rand: Rand) {
      for (const s of facadeSlots(floors)) {
        q.setFromAxisAngle(UP, s.nx ? Math.PI / 2 : 0);
        const pane = place(buildingMatrix, s.x + s.nx * 0.06, s.y, s.z + s.nz * 0.06);
        if (rand() < LIT_RATIO) {
          lit.push(pane);
          addLive(buildingMatrix, s, pane);
        } else dark.push(pane);
        q.setFromAxisAngle(UP, s.nx ? Math.PI / 2 : 0);
        sills.push(place(buildingMatrix, s.x + s.nx * 0.12, s.y - 0.98, s.z + s.nz * 0.12));
        sillColors.push(trim);
      }
    },

    build(parent: THREE.Object3D) {
      // Each lit window has a hidden twin in the dark batch, shown once its lights go out.
      for (const w of live) w.dark = dark.push(HIDDEN) - 1;
      litMesh = instanced(parent, paneGeometry, mats.windowLit, lit);
      darkMesh = instanced(parent, paneGeometry, mats.windowDark, dark);
      instanced(parent, sillGeometry, mats.sill, sills, sillColors).castShadow = true;
      SHAPES.forEach((rects, i) =>
        shapeMeshes.push(instanced(parent, shapeGeometry(rects), silhouette, shapeMatrices[i])),
      );
    },

    update(hour: number, night: number) {
      if (Math.abs(night - lastNight) >= NIGHT_EPSILON) {
        lastNight = night;
        silhouette.color.lerpColors(...SILHOUETTE, night);
      }
      if (!litMesh || Math.abs(hour - lastHour) < HOUR_EPSILON) return;
      lastHour = hour;
      let changed = false;
      for (const w of live) {
        const off = lightsOut(hour, w.offAt, w.onAt);
        if (off === w.off) continue;
        apply(w, off);
        changed = true;
      }
      if (!changed) return;
      litMesh.instanceMatrix.needsUpdate = true;
      darkMesh!.instanceMatrix.needsUpdate = true;
      for (const m of shapeMeshes) m.instanceMatrix.needsUpdate = true;
    },
  };
}
