import * as THREE from 'three';
import { radialTexture, textTexture } from '../gfx/textures.ts';
import { box, type Vec3 } from '../gfx/voxel.ts';
import { rng } from '../utils/random.ts';
import {
  type AttractGame,
  attractTexture,
  blinkTexture,
  carpetTexture,
  neonTexture,
  SCREEN_FRAMES,
} from './arcadeScreens.ts';
import { type BuildingDeps, placeFacingAvenue } from './buildings.ts';
import { BUILDING, SIDEWALK_Y, WALK_HALF } from './layout.ts';
import type { Lot, WorldEnv } from './lots.ts';
import type { XZ } from './types.ts';

/** The free cabinet: stand on `spot` to get the “Play” prompt. */
export interface ArcadeStation {
  type: 'arcade';
  label: string;
  spot: XZ;
  heading: number;
}

// Building space as in buildings.ts, with `u` along the facade toward the spawn (local x = side * u).
const ARCADE_SEED = 1978; // own stream: the filler it replaces keeps its stream untouched
const FLOORS = 2;
const { width: W, depth: D, groundFloor: GF, floor: FLOOR } = BUILDING;
const F = D / 2;
const H = GF + FLOORS * FLOOR;
const BACK = 1.8; // local z of the ground floor's back wall
const CEIL = 3.6; // under the sign band, and low enough for the avenue camera to see the back wall
const WALL_U = 6.15; // inner face of the end walls
const DOOR = { from: 3.2, to: 6.1 }; // the walk-in bay at the spawnward end
const PARTITION_U = 3.1; // glass between the bay and the hall
const WINDOW_MID = (-WALL_U + DOOR.from - 0.2) / 2;
const WINDOW_W = DOOR.from - 0.2 + WALL_U;
const SILL = 0.7;
const STATION_U = (DOOR.from + DOOR.to) / 2;
const CABINET_DEPTH = 0.76;
const STAND_Z = 3.7; // where the player stands to play, in front of the control panel
const ROOM_FRONT_OF_STATION = 2.95; // walkable from the control panel's edge to the facade
const HALL_GAMES: [AttractGame, string, string, number][] = [
  ['kommit', 'MORTAL KOMMIT', '#ff4f4f', -4.7],
  ['react', 'REACT BROS', '#35d6ff', -2.2],
  ['kong', 'CRYPTO KONG', '#ffd23f', 0.4],
];
const MULLIONS_U = [-3.45, -0.9];
const FACADE = '#2a2140';
const TRIM = new THREE.Color('#17122a');
const INTERIOR = '#0f0b1c';
const CABINET = '#15131f';
const PINK = '#ff4fa3';
const CYAN = '#35d6ff';
const GREEN = '#5fe07a';
const ROOF_BUG = [
  '..#....#..',
  '...#..#...',
  '..######..',
  '.##.##.##.',
  '##########',
  '#.######.#',
  '#.#....#.#',
  '...##.##..',
];
const ROOF_PIXEL = 0.42;
const ATTRACT_FPS = 3;
const BLINK_RATE = 1.4; // FREE PLAY / INSERT COIN swaps per second
const NEON_DAY = 0.55; // tubes look unlit in daylight
const NIGHT_EPSILON = 0.001;

const glowMaterial = (map: THREE.Texture) =>
  new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

function plane(parent: THREE.Object3D, material: THREE.Material, [w, h]: [number, number], [x, y, z]: Vec3) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A cabinet facing local +Z, standing on the carpet; returns its attract screen to animate.
function cabinet(parent: THREE.Object3D, game: AttractGame, title: string, accent: string, x: number, z: number) {
  const c = new THREE.Group();
  c.position.set(x, SIDEWALK_Y, z);
  parent.add(c);
  const front = CABINET_DEPTH / 2;
  box(c, CABINET, [0.84, 1.9, CABINET_DEPTH], [0, 0.95, 0]);
  box(c, '#0b0710', [0.84, 0.08, CABINET_DEPTH], [0, 1.94, 0]);
  for (const sx of [-1, 1]) box(c, accent, [0.06, 2.0, CABINET_DEPTH + 0.04], [sx * 0.45, 1.0, 0]);
  box(c, '#07070c', [0.74, 0.62, 0.04], [0, 1.38, front + 0.02]);
  box(c, accent, [0.84, 0.1, 0.34], [0, 1.0, front + 0.15]); // control panel
  box(c, '#111111', [0.04, 0.12, 0.04], [-0.18, 1.11, front + 0.15], { shadow: false });
  box(c, '#e33333', [0.09, 0.09, 0.09], [-0.18, 1.2, front + 0.15], { shadow: false });
  box(c, '#ffd23f', [0.07, 0.03, 0.07], [0.08, 1.065, front + 0.13], { shadow: false });
  box(c, CYAN, [0.07, 0.03, 0.07], [0.22, 1.065, front + 0.13], { shadow: false });
  box(c, '#2a2a38', [0.26, 0.32, 0.02], [0, 0.55, front + 0.01]); // coin door
  box(c, '#ff3355', [0.05, 0.08, 0.02], [0, 0.62, front + 0.03], { shadow: false });

  const marquee = textTexture([title], { width: 320, height: 80, bg: '#0b0710', fg: accent, sizes: [28] });
  plane(c, new THREE.MeshBasicMaterial({ map: marquee }), [0.8, 0.2], [0, 1.8, front + 0.02]);

  const texture = attractTexture(game);
  const screen = plane(c, new THREE.MeshBasicMaterial({ map: texture }), [0.64, 0.48], [0, 1.38, front + 0.045]);
  screen.userData.dynamic = true;
  return texture;
}

// A space-invader bug on the roof: the shop's silhouette from down the avenue.
function roofBug(g: THREE.Group, side: number) {
  const top = H + 0.6;
  ROOF_BUG.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '#') continue;
      const u = (i - (row.length - 1) / 2) * ROOF_PIXEL;
      const y = top + 0.8 + (ROOF_BUG.length - 1 - j) * ROOF_PIXEL;
      box(g, PINK, [ROOF_PIXEL, ROOF_PIXEL, ROOF_PIXEL], [side * u, y, 2.5]);
    }
  });
  for (const u of [-1.2, 1.2]) box(g, TRIM, [0.2, 0.9, 0.2], [side * u, top + 0.45, 2.5]);
}

/**
 * An arcade across from experience 4 (SPECIAL_LOTS): a walk-in bay at its spawnward end and one
 * free “Bug Invaders” cabinet facing the avenue, so the trailing camera sees it from the street.
 */
export function buildArcade(_i: number, side: number, z: number, deps: BuildingDeps): Lot & { arcade: ArcadeStation } {
  const g = new THREE.Group();
  placeFacingAvenue(g, side, z);
  const at = (u: number, y: number, lz: number): Vec3 => [side * u, y, lz];
  const inside = F - BACK;
  const insideMid = (F + BACK) / 2;

  // Shell: upper floors, the ground floor's back, the sign band, both end walls.
  box(g, FACADE, [W, H - GF, D], [0, GF + (H - GF) / 2, 0]);
  box(g, FACADE, [W, GF, F + BACK], [0, GF / 2, (BACK - F) / 2]);
  box(g, FACADE, [W, GF - CEIL, inside], [0, (GF + CEIL) / 2, insideMid]);
  for (const e of [-1, 1])
    box(g, FACADE, [W / 2 - WALL_U, CEIL, inside], at((e * (W / 2 + WALL_U)) / 2, CEIL / 2, insideMid));
  box(g, TRIM, [W + 0.4, 0.35, D + 0.4], [0, GF, 0]);
  box(g, TRIM, [W + 0.6, 0.6, D + 0.6], [0, H + 0.3, 0]);
  for (const e of [-1, 1]) box(g, TRIM, [0.7, H, 0.7], at(e * (W / 2), H / 2, F));
  const rand = rng(ARCADE_SEED);
  deps.windows.addBuilding(g.matrix, FLOORS, TRIM, rand);
  box(g, '#b9bcc2', [1.6, 1, 1.6], at(-4 + rand() * 2, H + 1.1, -3 - rand() * 2));
  roofBug(g, side);

  // Dark interior: panels, carpet, neon strips under the ceiling.
  box(g, INTERIOR, [2 * WALL_U, CEIL, 0.04], [0, CEIL / 2, BACK + 0.04]);
  box(g, INTERIOR, [2 * WALL_U, 0.04, inside], [0, CEIL - 0.04, insideMid]);
  for (const e of [-1, 1]) box(g, INTERIOR, [0.04, CEIL, inside], at(e * (WALL_U - 0.04), CEIL / 2, insideMid));
  box(g, '#0d0a1a', [2 * WALL_U, SIDEWALK_Y, inside], [0, SIDEWALK_Y / 2, insideMid], { shadow: false });
  const carpet = carpetTexture();
  carpet.repeat.set((2 * WALL_U) / 1.5, inside / 1.5);
  const rug = plane(
    g,
    new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }),
    [2 * WALL_U, inside],
    [0, SIDEWALK_Y + 0.025, insideMid],
  );
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;
  const pinkTube = new THREE.MeshBasicMaterial({ color: PINK });
  const cyanTube = new THREE.MeshBasicMaterial({ color: CYAN });
  box(g, pinkTube, [2 * WALL_U - 0.3, 0.06, 0.06], [0, CEIL - 0.12, BACK + 0.3], { shadow: false });
  box(g, cyanTube, [2 * WALL_U - 0.3, 0.06, 0.06], [0, CEIL - 0.12, F - 0.5], { shadow: false });

  // Shop window over the hall, a glass partition beside the walk-in bay.
  const glass = new THREE.MeshStandardMaterial({
    color: '#2a2146',
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
    metalness: 0.6,
    depthWrite: false,
  });
  box(g, TRIM, [WINDOW_W, SILL, 0.3], at(WINDOW_MID, SILL / 2, F - 0.1));
  box(g, glass, [WINDOW_W, CEIL - SILL, 0.06], at(WINDOW_MID, SILL + (CEIL - SILL) / 2, F - 0.15), { shadow: false });
  for (const u of MULLIONS_U) box(g, TRIM, [0.12, CEIL - SILL, 0.16], at(u, SILL + (CEIL - SILL) / 2, F - 0.1));
  box(g, TRIM, [0.2, CEIL, 0.3], at(PARTITION_U, CEIL / 2, F - 0.15));
  box(g, glass, [0.05, CEIL - 0.1, inside - 0.3], at(PARTITION_U, CEIL / 2, (BACK + F - 0.3) / 2), { shadow: false });

  const screens = HALL_GAMES.map(([game, title, accent, u]) =>
    cabinet(g, game, title, accent, side * u, BACK + 0.06 + CABINET_DEPTH / 2),
  );
  screens.push(cabinet(g, 'invaders', 'BUG INVADERS', GREEN, side * STATION_U, BACK + 0.06 + CABINET_DEPTH / 2));

  // “FREE PLAY” / “INSERT COIN” over the free cabinet, above the hero's head as seen from the street.
  const blink = blinkTexture(['FREE PLAY', 'INSERT COIN'], [GREEN, '#ffd23f']);
  plane(g, new THREE.MeshBasicMaterial({ map: blink }), [1.2, 0.6], at(STATION_U, 2.62, BACK + 0.09));
  const padMaterial = new THREE.MeshBasicMaterial({
    color: GREEN,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const pad = plane(g, padMaterial, [1.3, 1.1], at(STATION_U, SIDEWALK_Y + 0.05, STAND_Z));
  pad.rotation.x = -Math.PI / 2;

  // Neon: the board over the window, a blade over the bay (read edge-on from the avenue), light on the sidewalk.
  const neon = new THREE.MeshBasicMaterial({ map: neonTexture(['ARCADE'], { width: 1024, height: 160, color: PINK }) });
  plane(g, neon, [7.4, 1.0], at(WINDOW_MID, 4.1, F + 0.03)); // between the window and the trim band
  const halo = glowMaterial(radialTexture('255,79,163'));
  plane(g, halo, [10, 2.8], at(WINDOW_MID, 4.1, F + 0.1));
  const bladeFace = new THREE.MeshBasicMaterial({
    map: neonTexture(['A', 'R', 'C', 'A', 'D', 'E'], { width: 128, height: 640, color: CYAN }),
  });
  const edge = new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.9 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.64), [bladeFace, bladeFace, edge, edge, edge, edge]);
  blade.position.set(...at(W / 2, 6.9, F + 0.85));
  g.add(blade);
  for (const y of [5.6, 8.2]) box(g, TRIM, [0.12, 0.12, 0.6], at(W / 2, y, F + 0.3));
  const pool = glowMaterial(radialTexture('255,110,190'));
  const spill = plane(g, pool, [12, 3.4], at(0.4, SIDEWALK_Y + 0.07, F + 1.7));
  spill.rotation.x = -Math.PI / 2;

  deps.colliders.addRoom(
    side > 0
      ? { minX: WALK_HALF, maxX: WALK_HALF + F - ROOM_FRONT_OF_STATION, minZ: z + DOOR.from, maxZ: z + DOOR.to }
      : { minX: -WALK_HALF - F + ROOM_FRONT_OF_STATION, maxX: -WALK_HALF, minZ: z + DOOR.from, maxZ: z + DOOR.to },
  );

  let lastFrame = -1;
  let lastBlink = -1;
  let lastGlow = -1;

  return {
    object: g,
    arcade: {
      type: 'arcade',
      label: 'Bug Invaders',
      spot: { x: side * (WALK_HALF + F - STAND_Z), z: z + STATION_U },
      heading: (side * Math.PI) / 2,
    },

    update(_dt: number, t: number, { night }: WorldEnv) {
      const frame = Math.floor(t * ATTRACT_FPS) % SCREEN_FRAMES;
      if (frame !== lastFrame) {
        lastFrame = frame;
        // Out of step, so the cabinets don't all flip at once.
        for (let k = 0; k < screens.length; k++) screens[k].offset.x = ((frame + k) % SCREEN_FRAMES) / SCREEN_FRAMES;
      }
      const on = Math.floor(t * BLINK_RATE) % 2;
      if (on !== lastBlink) {
        lastBlink = on;
        blink.offset.y = on ? 0 : 0.5;
      }
      padMaterial.opacity = 0.3 + Math.sin(t * 4) * 0.12;

      // A tired tube: now and then the sign stutters at night.
      const stutter = night > 0.3 && Math.sin(t * 7.3) + Math.sin(t * 2.1) > 1.82 ? 0.35 : 1;
      const glow = night * stutter;
      if (Math.abs(glow - lastGlow) < NIGHT_EPSILON) return;
      lastGlow = glow;
      const tint = NEON_DAY + (1 - NEON_DAY) * glow;
      neon.color.setScalar(tint);
      bladeFace.color.setScalar(tint);
      pinkTube.color.set(PINK).multiplyScalar(tint);
      halo.opacity = 0.55 * glow;
      pool.opacity = 0.4 * glow;
    },
  };
}
