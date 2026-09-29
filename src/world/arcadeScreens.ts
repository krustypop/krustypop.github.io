import * as THREE from 'three';
import { rng } from '../utils/random.ts';

// Canvas textures of the arcade shop: attract-mode sprite sheets, neon lettering and the carpet.

const PIXEL_FONT = '"Press Start 2P", monospace';
export const SCREEN_FRAMES = 4;
const FW = 96; // one attract frame, in canvas pixels
const FH = 72;
const CARPET_SEED = 1981;

export type AttractGame = 'kommit' | 'react' | 'kong' | 'invaders';

type Ctx = CanvasRenderingContext2D;

function canvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return [c, c.getContext('2d')!];
}

function pixelTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function text(ctx: Ctx, value: string, x: number, y: number, color: string, size = 8) {
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

// Draws a sprite given as rows of '#' (color) and '.' (empty), `px` canvas pixels per dot.
function sprite(ctx: Ctx, rows: string[], x: number, y: number, color: string, px = 2, flip = false) {
  ctx.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') ctx.fillRect(x + (flip ? row.length - 1 - i : i) * px, y + j * px, px, px);
    }
  });
}

const FIGHTER = [
  ['.##.', '.##.', '####', '#.##', '.##.', '.#.#', '#..#'],
  ['.##.', '.##.', '#####', '.##..', '.##.', '#..#', '#..#'],
];
const BUG_SPRITE = [
  ['..#....#..', '...#..#...', '..######..', '.##.##.##.', '##########', '#.######.#', '#.#....#.#', '...##.##..'],
  ['..#....#..', '#..#..#..#', '#.######.#', '###.##.###', '##########', '.########.', '..#....#..', '.#......#.'],
];

// Each game draws one attract frame at (x0, 0); frames loop, so motion must wrap at SCREEN_FRAMES.
const ATTRACT: Record<AttractGame, (ctx: Ctx, f: number, x0: number) => void> = {
  kommit(ctx, f, x0) {
    text(ctx, 'MORTAL', x0 + FW / 2, 4, '#ffd23f');
    text(ctx, 'KOMMIT', x0 + FW / 2, 14, '#ff4f4f');
    ctx.fillStyle = '#3a2a4a';
    ctx.fillRect(x0, 58, FW, 14);
    const hit = f % 2 === 1;
    sprite(ctx, FIGHTER[hit ? 1 : 0], x0 + 26 + (hit ? 4 : 0), 30, '#35d6ff', 4);
    sprite(ctx, FIGHTER[0], x0 + 56 + (hit ? 3 : 0), 30, '#ff4fa3', 4, true);
    if (hit) text(ctx, '!', x0 + 52, 24, '#ffffff');
    text(ctx, f < 2 ? 'FIGHT' : 'MERGE', x0 + FW / 2, 62, '#ffffff');
  },

  react(ctx, f, x0) {
    text(ctx, 'REACT', x0 + FW / 2, 4, '#61dafb');
    text(ctx, 'BROS', x0 + FW / 2, 14, '#ffffff');
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(x0, 26, FW, 32);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#b85a1a' : '#d9782a';
      ctx.fillRect(x0 + k * 16, 58, 16, 14);
    }
    ctx.fillStyle = '#ffb800';
    ctx.fillRect(x0 + 58, 30, 12, 12);
    text(ctx, '?', x0 + 64, 32, '#7a3a00');
    const jump = [0, 6, 10, 6][f];
    ctx.fillStyle = '#e03030';
    ctx.fillRect(x0 + 24 + f * 6, 46 - jump, 8, 6);
    ctx.fillStyle = '#2f6fed';
    ctx.fillRect(x0 + 24 + f * 6, 52 - jump, 8, 6);
  },

  kong(ctx, f, x0) {
    text(ctx, 'CRYPTO', x0 + FW / 2, 4, '#ff9f1c');
    text(ctx, 'KONG', x0 + FW / 2, 14, '#ffffff');
    ctx.fillStyle = '#e0457b';
    for (let k = 0; k < 3; k++) ctx.fillRect(x0 + (k % 2 ? 8 : 0), 36 + k * 12, FW - 8, 3);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x0 + 6, 26, 12, 10);
    for (let k = 0; k < 3; k++) {
      const x = x0 + ((f * 8 + k * 30) % (FW - 12)) + 4;
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x, 30 + k * 12, 6, 6);
      ctx.fillStyle = '#b98a1e';
      ctx.fillRect(x + 2, 31 + k * 12, 2, 4);
    }
  },

  invaders(ctx, f, x0) {
    text(ctx, 'BUG', x0 + FW / 2, 4, '#5fe07a');
    text(ctx, 'INVADERS', x0 + FW / 2, 14, '#ffffff');
    for (let k = 0; k < 4; k++) sprite(ctx, BUG_SPRITE[f % 2], x0 + 8 + k * 21 + (f % 2) * 2, 28, '#ff5d8f');
    if (f < 2) text(ctx, 'INSERT', x0 + FW / 2, 50, '#ffd23f');
    if (f < 2) text(ctx, 'COIN', x0 + FW / 2, 60, '#ffd23f');
  },
};

/** A sprite sheet of SCREEN_FRAMES attract frames; show one with `offset.x = frame / SCREEN_FRAMES`. */
export function attractTexture(game: AttractGame) {
  const [c, ctx] = canvas(FW * SCREEN_FRAMES, FH);
  ctx.fillStyle = '#06070d';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let f = 0; f < SCREEN_FRAMES; f++) ATTRACT[game](ctx, f, f * FW);
  const tex = pixelTexture(c);
  tex.repeat.set(1 / SCREEN_FRAMES, 1);
  return tex;
}

/** Neon tube lettering on a dark board; `lines` stack vertically. */
export function neonTexture(
  lines: string[],
  { width, height, color }: { width: number; height: number; color: string },
) {
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = '#120c1c';
  ctx.fillRect(0, 0, width, height);
  const size = Math.min((height * 0.8) / (lines.length * 1.1), (width * 0.8) / Math.max(...lines.map((l) => l.length)));
  ctx.font = `${Math.floor(size)}px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.shadowBlur = 18;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  lines.forEach((line, i) => {
    const y = height / 2 + (i - (lines.length - 1) / 2) * size * 1.1;
    ctx.fillStyle = color;
    ctx.shadowBlur = 22;
    ctx.fillText(line, width / 2, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff4fb'; // hot white core of the tube
    ctx.globalAlpha = 0.55;
    ctx.fillText(line, width / 2, y);
    ctx.globalAlpha = 1;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Two stacked frames (top, bottom) alternated with `offset.y`. */
export function blinkTexture([a, b]: [string, string], colors: [string, string]) {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = '#0b0710';
  ctx.fillRect(0, 0, 256, 128);
  [a, b].forEach((label, i) => {
    const size = Math.min(32, Math.floor(220 / label.length));
    ctx.shadowColor = colors[i];
    ctx.shadowBlur = 12;
    text(ctx, label, 128, i * 64 + 32 - size / 2, colors[i], size);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1, 0.5);
  return tex;
}

// The classic bowling-alley carpet: neon confetti on midnight blue, seeded so it never changes.
export function carpetTexture() {
  const size = 128;
  const [c, ctx] = canvas(size, size);
  const rand = rng(CARPET_SEED);
  ctx.fillStyle = '#16123a';
  ctx.fillRect(0, 0, size, size);
  const colors = ['#ff4fa3', '#35d6ff', '#ffd23f', '#8a5cff'];
  for (let k = 0; k < 42; k++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = colors[k % colors.length];
    const shape = k % 3;
    if (shape === 0) {
      for (let s = 0; s < 4; s++) ctx.fillRect((x + s * 2) % size, (y + (s % 2) * 2) % size, 2, 2); // squiggle
    } else if (shape === 1) {
      for (let s = 0; s < 3; s++) ctx.fillRect(x + s, y + s, 3 - s, 1); // triangle
    } else {
      ctx.fillRect(x, y + 1, 3, 1); // star
      ctx.fillRect(x + 1, y, 1, 3);
    }
  }
  const tex = pixelTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
