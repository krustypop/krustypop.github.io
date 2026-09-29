import * as THREE from 'three';
import type { Emblem } from '../data.ts';
import { textTexture } from '../gfx/textures.ts';
import { box, type Vec3 } from '../gfx/voxel.ts';
import { GOLD, INK, label, PAPER, rotatedBox } from './emblems.ts';
import { SIDEWALK_Y } from './layout.ts';

// A ground floor dressed for each job, in building space (facade at z = F, the sidewalk toward +Z).
// Keep |x| < 1.6 free (door and glowing pad), and stay under the storefront sign (y < 3.5).
const WINDOW_X = 4;
const STEEL = '#9aa0aa';
const Y = SIDEWALK_Y; // props stand on the sidewalk, not on the building's base

export interface StorefrontContext {
  g: THREE.Group;
  accent: THREE.Color;
  trim: THREE.Color;
  F: number;
  side: number;
  // Round obstacle so the player bumps into props that stick out onto the sidewalk.
  block: (x: number, z: number, r: number) => void;
  awning: () => void;
}

// Text shown in both shop windows, just in front of the glass.
function windowSigns({ g, F }: StorefrontContext, texts: [string, string], colors: [string, string]) {
  texts.forEach((text, i) => label(g, text, [2.6, 1.1], [(i === 0 ? -1 : 1) * WINDOW_X, 2.0, F + 0.2], colors));
}

function stripedAwning({ g, F }: StorefrontContext, x: number, colors: [THREE.ColorRepresentation, string]) {
  const stripes = 7;
  const w = 3.8 / stripes;
  for (let k = 0; k < stripes; k++) {
    const sx = x - 1.9 + w * (k + 0.5);
    const color = colors[k % 2];
    box(g, color, [w, 0.16, 1.2], [sx, 3.25, F + 0.6]);
    box(g, color, [w, 0.34, 0.08], [sx, 3.0, F + 1.18]); // valance
  }
}

function hangingCard(
  g: THREE.Group,
  lines: string[],
  [w, h]: [number, number],
  [x, y, z]: Vec3,
  colors: [string, string],
) {
  const map = textTexture(lines, {
    width: 256,
    height: Math.round((256 * h) / w),
    bg: colors[0],
    fg: colors[1],
    sizes: [40],
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
  card.position.set(x, y, z);
  g.add(card);
}

const BUILDERS: Record<Emblem, (ctx: StorefrontContext) => void> = {
  // School: a columned porch and a flag.
  cap(ctx) {
    const { g, F, side } = ctx;
    for (const sx of [-1, 1]) {
      box(g, PAPER, [0.7, 0.3, 0.7], [sx * 2.0, Y + 0.15, F + 0.6]);
      box(g, '#e7e0d0', [0.45, 2.8, 0.45], [sx * 2.0, Y + 1.7, F + 0.6]);
      ctx.block(sx * 2.0, F + 0.6, 0.45);
    }
    box(g, PAPER, [4.8, 0.4, 1.2], [0, 3.3, F + 0.6]);
    windowSigns(ctx, ['BTS', 'A+'], [INK, '#9dffc4']);

    // Leans up and out over the sidewalk, at the spawn-side end of the facade, under the blade sign.
    const pole = new THREE.Group();
    pole.position.set(side * 5.7, 3.0, F);
    pole.rotation.x = -Math.PI / 4; // negative: tips local +Z (the pole) upward
    box(pole, STEEL, [0.12, 0.12, 2.4], [0, 0, 1.2]);
    ['#2a4fa8', '#f5f5f0', '#d0343a'].forEach((c, i) => box(pole, c, [0.06, 0.9, 0.45], [0, -0.5, 1.0 + i * 0.45]));
    g.add(pole);
  },

  // Time sheets and invoices: office awnings, a punch clock, a water cooler.
  clock(ctx) {
    const { g, F, side, trim } = ctx;
    ctx.awning();
    for (const sx of [-1, 1]) stripedAwning(ctx, sx * WINDOW_X, [trim, '#e4e6ea']);
    windowSigns(ctx, ['PTO', 'INVOICES'], [PAPER, INK]);

    box(g, '#8b8f99', [0.6, 0.9, 0.3], [1.95, 1.6, F + 0.15]);
    label(g, '08:59', [0.46, 0.22], [1.95, 1.8, F + 0.32], ['#1f3a2c', '#9dffc4']);
    box(g, INK, [0.3, 0.05, 0.05], [1.95, 1.45, F + 0.31]); // card slot

    const x = -side * 2.6;
    box(g, '#eceef4', [0.6, 1.1, 0.6], [x, Y + 0.55, F + 0.5]);
    box(g, '#6fb3e6', [0.44, 0.6, 0.44], [x, Y + 1.4, F + 0.5]);
    box(g, '#4a8fc4', [0.16, 0.12, 0.08], [x, Y + 0.85, F + 0.83]); // tap
    ctx.block(x, F + 0.5, 0.45);
  },

  // Private sales: striped awnings, a VIP rope line, shopping bags.
  bag(ctx) {
    const { g, F, side, accent } = ctx;
    ctx.awning();
    for (const sx of [-1, 1]) stripedAwning(ctx, sx * WINDOW_X, ['#c8503f', '#fdf7ea']);
    windowSigns(ctx, ['-70%', 'VIP'], ['#c8503f', '#ffffff']);

    for (const sx of [-1, 1]) {
      for (const z of [F + 1.0, F + 2.4]) {
        box(g, GOLD, [0.5, 0.08, 0.5], [sx * 1.8, Y + 0.04, z]);
        box(g, GOLD, [0.14, 1.0, 0.14], [sx * 1.8, Y + 0.5, z]);
        box(g, GOLD, [0.24, 0.12, 0.24], [sx * 1.8, Y + 1.04, z]);
        ctx.block(sx * 1.8, z, 0.25);
      }
      box(g, '#a3182b', [0.08, 0.08, 1.3], [sx * 1.8, Y + 0.9, F + 1.7]);
    }

    const x = side * 3.4;
    const bags: [THREE.ColorRepresentation, number, number][] = [
      [accent, 0, 0.9],
      ['#2f6fed', 0.6, 0.7],
      ['#f2c14e', -0.55, 0.6],
    ];
    for (const [color, dx, h] of bags) {
      box(g, color, [0.5, h, 0.3], [x + dx, Y + h / 2, F + 0.4]);
      box(g, INK, [0.3, 0.06, 0.06], [x + dx, Y + h + 0.12, F + 0.4]);
    }
    ctx.block(x, F + 0.4, 0.7);
  },

  // Luxury rentals: topiaries, lanterns, luggage by the door.
  house(ctx) {
    const { g, F, side } = ctx;
    ctx.awning();
    windowSigns(ctx, ['VILLA', 'LOFT'], [PAPER, INK]);
    for (const sx of [-1, 1]) {
      const x = sx * 2.05;
      box(g, '#6b6f78', [0.8, 0.7, 0.8], [x, Y + 0.35, F + 0.55]);
      [0.8, 0.6, 0.4].forEach((s, k) =>
        box(g, k % 2 ? '#4f9a3a' : '#3f8a33', [s, 0.5, s], [x, Y + 0.95 + k * 0.45, F + 0.55]),
      );
      box(g, '#3f8a33', [0.26, 0.26, 0.26], [x, Y + 2.4, F + 0.55]);
      ctx.block(x, F + 0.55, 0.5);
      box(g, INK, [0.3, 0.5, 0.3], [sx * 1.7, 2.5, F + 0.3]); // lantern
      box(g, '#ffd27a', [0.2, 0.3, 0.32], [sx * 1.7, 2.5, F + 0.3]);
    }
    const x = side * 3.6;
    box(g, '#3a5a8c', [1.0, 0.7, 0.45], [x, Y + 0.35, F + 0.45]);
    box(g, '#b0413e', [0.8, 0.55, 0.4], [x, Y + 0.98, F + 0.45]);
    box(g, INK, [0.3, 0.08, 0.08], [x, Y + 1.32, F + 0.45]);
    ctx.block(x, F + 0.45, 0.6);
  },

  // Hotel rooms: an entrance canopy, a luggage cart, a do-not-disturb card.
  octagon(ctx) {
    const { g, F, side, accent } = ctx;
    box(g, accent, [3.8, 0.3, 3.0], [0, 3.2, F + 1.5]);
    box(g, GOLD, [3.9, 0.12, 3.1], [0, 3.02, F + 1.5]);
    for (const sx of [-1, 1]) {
      box(g, GOLD, [0.12, 3.0, 0.12], [sx * 1.8, Y + 1.45, F + 2.9]);
      ctx.block(sx * 1.8, F + 2.9, 0.2);
    }
    windowSigns(ctx, ['ROOM 404', 'WIFI OK'], [INK, '#ffffff']);
    hangingCard(g, ['DO NOT', 'DISTURB'], [0.5, 0.8], [0.65, 1.0, F + 0.38], ['#c8503f', '#ffffff']);

    const x = side * 3.6;
    box(g, GOLD, [1.5, 0.12, 0.8], [x, Y + 0.4, F + 0.8]);
    for (const dx of [-0.65, 0.65]) box(g, GOLD, [0.1, 1.9, 0.1], [x + dx, Y + 1.3, F + 0.8]);
    box(g, GOLD, [1.4, 0.1, 0.1], [x, Y + 2.25, F + 0.8]);
    box(g, '#6f7fd1', [0.9, 0.6, 0.45], [x, Y + 0.76, F + 0.8]);
    box(g, '#d9a441', [0.6, 0.45, 0.4], [x, Y + 1.28, F + 0.8]);
    for (const dx of [-0.6, 0.6]) box(g, INK, [0.15, 0.2, 0.2], [x + dx, Y + 0.1, F + 0.8]);
    ctx.block(x, F + 0.8, 0.8);
  },

  // Crypto: a crypto ATM, a rocket to the moon, a chart that only goes up.
  coin(ctx) {
    const { g, F, side } = ctx;
    ctx.awning();
    windowSigns(ctx, ['HODL', ''], [INK, GOLD]);
    const cx = WINDOW_X * side;
    box(g, INK, [2.6, 1.1, 0.04], [cx, 2.0, F + 0.19]);
    [0.2, 0.35, 0.3, 0.55, 0.75, 0.95].forEach((h, k) =>
      box(g, '#3ddc84', [0.3, h, 0.04], [cx - 1.0 + k * 0.4, 1.5 + h / 2, F + 0.22]),
    );

    const atm = -side * 3.6;
    box(g, '#2b2f3a', [1.1, 2.1, 0.8], [atm, Y + 1.05, F + 0.45]);
    label(g, 'BTC', [0.7, 0.4], [atm, Y + 1.55, F + 0.86], ['#1f3a2c', '#9dffc4']);
    box(g, STEEL, [0.6, 0.3, 0.1], [atm, Y + 1.05, F + 0.88]);
    box(g, GOLD, [0.5, 0.06, 0.06], [atm, Y + 0.7, F + 0.88]); // coin slot
    ctx.block(atm, F + 0.45, 0.65);

    const r = side * 2.6;
    box(g, '#eceef4', [0.6, 1.6, 0.6], [r, Y + 1.2, F + 0.5]);
    box(g, '#c8503f', [0.4, 0.3, 0.4], [r, Y + 2.15, F + 0.5]);
    box(g, '#c8503f', [0.2, 0.2, 0.2], [r, Y + 2.4, F + 0.5]);
    box(g, '#6fb3e6', [0.3, 0.3, 0.05], [r, Y + 1.5, F + 0.82]); // porthole
    for (const dx of [-0.4, 0.4]) box(g, '#c8503f', [0.2, 0.5, 0.5], [r + dx, Y + 0.55, F + 0.5]);
    box(g, '#f28c28', [0.35, 0.3, 0.35], [r, Y + 0.3, F + 0.5]); // flame
    ctx.block(r, F + 0.5, 0.45);
  },

  // Hardware wallets: a bank-vault door, a PIN pad, bollards.
  device(ctx) {
    const { g, F, side } = ctx;
    ctx.awning();
    windowSigns(ctx, ['COLD', 'STORAGE'], ['#1f2a30', '#9dffc4']);
    const y = 1.45;
    const z = F + 0.45;
    box(g, '#6b707a', [2.5, 2.5, 0.3], [0, y, z]);
    rotatedBox(g, '#6b707a', [2.5, 2.5, 0.3], [0, y, z], 'z');
    box(g, STEEL, [2.0, 2.0, 0.34], [0, y, z]);
    rotatedBox(g, STEEL, [2.0, 2.0, 0.34], [0, y, z], 'z');
    box(g, '#4a4f5c', [0.4, 0.4, 0.2], [0, y, z + 0.25]);
    box(g, '#4a4f5c', [1.3, 0.12, 0.12], [0, y, z + 0.3]);
    box(g, '#4a4f5c', [0.12, 1.3, 0.12], [0, y, z + 0.3]);
    rotatedBox(g, '#4a4f5c', [1.3, 0.12, 0.12], [0, y, z + 0.32], 'z');
    rotatedBox(g, '#4a4f5c', [0.12, 1.3, 0.12], [0, y, z + 0.32], 'z');

    box(g, INK, [0.4, 0.55, 0.12], [1.95, 1.5, F + 0.1]);
    label(g, 'PIN', [0.32, 0.16], [1.95, 1.64, F + 0.17], ['#1f2a30', '#9dffc4']);

    for (const sx of [-1, 1]) {
      box(g, '#4a4f5c', [0.3, 0.9, 0.3], [sx * 2.1, Y + 0.45, F + 1.8]);
      box(g, GOLD, [0.32, 0.12, 0.32], [sx * 2.1, Y + 0.7, F + 1.8]);
      ctx.block(sx * 2.1, F + 1.8, 0.25);
    }
    // Security camera on the far corner, watching the door.
    box(g, '#eceef4', [0.2, 0.2, 0.5], [-side * 5.9, 3.2, F + 0.25]);
    box(g, '#eceef4', [0.35, 0.3, 0.6], [-side * 5.9, 3.0, F + 0.6]);
    box(g, INK, [0.2, 0.15, 0.05], [-side * 5.9, 3.0, F + 0.92]);
  },
};

export function buildStorefront(emblem: Emblem, ctx: StorefrontContext) {
  BUILDERS[emblem](ctx);
}
