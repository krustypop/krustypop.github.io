import * as THREE from 'three';

const PIXEL_FONT = '"Press Start 2P", monospace';
const LINE_SPACING = 0.34; // of the canvas height
const MAX_TEXT_WIDTH = 0.88; // of the canvas width

function canvasTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Centered lines of text; each line shrinks until it fits. `sizes[i]` is line i's max font size. */
export interface TextTextureOptions {
  width: number;
  height: number;
  fg: string;
  sizes: number[];
  bg?: string;
  border?: string;
  font?: string;
}

export function textTexture(
  lines: string[],
  { width, height, fg, sizes, bg, border, font = PIXEL_FONT }: TextTextureOptions,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, width - 16, height - 16);
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    let size = sizes[i] ?? sizes.at(-1);
    do ctx.font = `${size}px ${font}`;
    while (ctx.measureText(line).width > width * MAX_TEXT_WIDTH && --size > 8);
    ctx.fillText(line, width / 2, height / 2 + (i - (lines.length - 1) / 2) * height * LINE_SPACING);
  });
  return canvasTexture(canvas);
}

/** Soft round spot, opaque `rgb` at the center fading to transparent. */
export function radialTexture(rgb: string, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
