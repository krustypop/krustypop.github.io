import { rng } from '../utils/random.ts';
import {
  type ArcadeState,
  ATOM,
  bugX,
  bugY,
  COFFEE_TIME,
  GROUND_Y,
  HERO,
  HUD_H,
  POINTS,
  RESTART_DELAY,
  SCREEN,
  SHIELD,
} from './arcadeGame.ts';

// Pixel art for “Bug Invaders”, drawn on a 160 × 144 canvas that CSS scales up without smoothing.

const FONT = '8px "Press Start 2P", monospace';
const BIG_FONT = '16px "Press Start 2P", monospace';
const C = {
  bg: '#0b0d1a',
  text: '#f4f1ff',
  dim: '#7a7fa8',
  hero: '#3178c6', // TypeScript blue
  key: '#cfe6ff',
  shot: '#ffe27a',
  bomb: '#ff7b54',
  shield: '#3178c6',
  atom: '#61dafb', // React cyan
  ground: '#5fe07a',
  heart: '#ff4f6d',
  coffee: '#c8894a',
  gold: '#ffd23f',
  pink: '#ff5d8f',
  eye: '#ffffff',
  shade: 'rgba(11, 13, 26, 0.78)',
};
const ROW_COLORS = [C.pink, '#b58cf2', '#b58cf2', C.ground];
const STARS = 40;
const BLINK = 2.5; // Hz

type Art = readonly string[];

// '#' is the sprite's color, 'o' white, '.' transparent.
const BUGS: readonly [Art, Art][] = [
  [
    ['....##....', '...####...', '..######..', '.##o##o##.', '.########.', '...#..#...', '..#.##.#..', '.#.#..#.#.'],
    ['....##....', '...####...', '..######..', '.##o##o##.', '.########.', '..#.##.#..', '.#......#.', '..#....#..'],
  ],
  [
    ['..#....#..', '...#..#...', '..######..', '.##o##o##.', '##########', '#.######.#', '#.#....#.#', '...##.##..'],
    ['..#....#..', '#..#..#..#', '#.######.#', '###o##o###', '##########', '.########.', '..#....#..', '.#......#.'],
  ],
  [
    ['...####...', '.########.', '##o####o##', '##########', '##.#..#.##', '..##..##..', '.##.##.##.', '##......##'],
    ['...####...', '.########.', '##o####o##', '##########', '##.#..#.##', '...#..#...', '..#.##.#..', '...#..#...'],
  ],
];
const ROW_ART = [0, 1, 1, 2];
const HERO_ART: Art = [
  '.....#.....',
  '....###....',
  '....#o#....',
  '.#########.',
  '###########',
  '##o#o#o#o##', // a keyboard for a cannon
  '###########',
];
const HERO_BOOM: [Art, Art] = [
  ['#...#..#..#', '..#...#..#.', '.#.#####.#.', '..#######..', '#.#o#o#o#.#', '.#########.', '#.#.#.#.#.#'],
  ['..#..#..#..', '#...#...#.#', '..#.###.#..', '.#.#####.#.', '..##o#o##..', '#.#######.#', '.#.#.#.#.#.'],
];
const SEMICOLON: Art = ['##', '##', '..', '##', '.#', '#.'];
const BOMB_ART: [Art, Art] = [
  ['.#.', '#..', '.#.', '..#', '.#.'],
  ['.#.', '..#', '.#.', '#..', '.#.'],
];
const ATOM_ART: Art = [
  '....###....',
  '..##...##..',
  '.#..#.#..#.',
  '#....#....#',
  '#...#o#...#',
  '#....#....#',
  '.#..#.#..#.',
  '..##...##..',
  '....###....',
];
const SPLAT: Art = [
  '#...#...#.',
  '.#..#..#..',
  '..#...#...',
  '##.....###',
  '...#....#.',
  '..#..#..#.',
  '.#...#...#',
  '#....#....',
];
const HEART: Art = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const CUP: Art = ['#####..', '#####.#', '#####.#', '#####..', '.###...'];
const POPUP_TEXT = new Map<number, string>(ATOM.points.map((p) => [p, `+${p}`]));

function bake(art: Art, color: string) {
  const c = document.createElement('canvas');
  c.width = art[0].length;
  c.height = art.length;
  const ctx = c.getContext('2d')!;
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      ctx.fillStyle = row[x] === 'o' ? C.eye : color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

function backdrop() {
  const c = document.createElement('canvas');
  c.width = SCREEN.w;
  c.height = SCREEN.h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  const rand = rng(8);
  for (let k = 0; k < STARS; k++) {
    ctx.fillStyle = k % 5 ? '#2a2f55' : '#5a608f';
    ctx.fillRect(Math.floor(rand() * SCREEN.w), HUD_H + Math.floor(rand() * (GROUND_Y - HUD_H - 30)), 1, 1);
  }
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, GROUND_Y + 1, SCREEN.w, 1);
  return c;
}

const pad5 = (n: number) => String(n).padStart(5, '0');

export function createArcadeRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const bg = backdrop();
  const bugs = ROW_ART.map((art, row) => BUGS[art].map((frame) => bake(frame, ROW_COLORS[row])));
  const hero = bake(HERO_ART, C.hero);
  const heroBoom = HERO_BOOM.map((art) => bake(art, C.bomb));
  const shot = bake(SEMICOLON, C.shot);
  const bombs = BOMB_ART.map((art) => bake(art, C.bomb));
  const atom = bake(ATOM_ART, C.atom);
  const splat = bake(SPLAT, C.text);
  const heart = bake(HEART, C.heart);
  const cup = bake(CUP, C.coffee);
  const legend: [HTMLCanvasElement, number, number, string][] = [
    [bugs[0][0], 26, 70, `= ${POINTS[0]}`],
    [bugs[1][0], 26, 84, `= ${POINTS[1]}`],
    [bugs[3][0], 90, 70, `= ${POINTS[3]}`],
    [atom, 90, 84, '= ???'],
  ];
  // Strings rebuilt only when their number changes.
  const cache = { score: -1, scoreText: '', best: -1, bestText: '', wave: -1, waveText: '', bonusText: '' };

  function write(text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left', font = FONT) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function refresh(s: ArcadeState) {
    if (s.score !== cache.score) cache.scoreText = pad5((cache.score = s.score));
    const best = Math.max(s.best, s.score);
    if (best !== cache.best) cache.bestText = pad5((cache.best = best));
    if (s.wave !== cache.wave) {
      cache.wave = s.wave;
      cache.waveText = `SPRINT ${s.wave}`;
      cache.bonusText = `BONUS +${50 * s.wave}`;
    }
  }

  function hud(s: ArcadeState) {
    write(cache.scoreText, 2, 2, C.text);
    write('HI', 50, 2, C.dim);
    write(cache.bestText, 68, 2, C.gold);
    for (let k = 0; k < s.lives; k++) ctx.drawImage(heart, SCREEN.w - 9 - k * 8, 2);
    if (s.coffee > 0) {
      ctx.drawImage(cup, 2, GROUND_Y + 3);
      ctx.fillStyle = C.coffee;
      ctx.fillRect(11, GROUND_Y + 4, Math.ceil((40 * s.coffee) / COFFEE_TIME), 3);
    }
  }

  function field(s: ArcadeState) {
    const frame = s.formation.frame;
    for (const b of s.bugs) if (b.alive) ctx.drawImage(bugs[b.row][frame], bugX(s, b.col), bugY(s, b.row));
    ctx.fillStyle = C.shield;
    for (let k = 0; k < s.shields.length; k++) {
      const cells = s.shields[k];
      for (let i = 0; i < cells.length; i++) {
        if (cells[i]) ctx.fillRect(SHIELD.xs[k] + (i % SHIELD.cols), SHIELD.y + Math.floor(i / SHIELD.cols), 1, 1);
      }
    }
    const flip = Math.floor(s.clock * 12) % 2;
    for (const p of s.shots) if (p.alive) ctx.drawImage(shot, Math.round(p.x), Math.round(p.y));
    for (const p of s.bombs) if (p.alive) ctx.drawImage(bombs[flip], Math.round(p.x), Math.round(p.y));
    if (s.atom.alive) ctx.drawImage(atom, Math.round(s.atom.x), ATOM.y);
    for (const p of s.splats) {
      if (p.ttl <= 0) continue;
      if (p.hero) ctx.drawImage(heroBoom[flip], p.x, p.y);
      else ctx.drawImage(splat, p.x, p.y);
    }
    if (s.phase === 'playing') ctx.drawImage(hero, Math.round(s.heroX), HERO.y);
    if (s.popup.ttl > 0) write(POPUP_TEXT.get(s.popup.points) ?? '', s.popup.x, s.popup.y, C.atom);
  }

  function title(s: ArcadeState, blink: boolean) {
    write('BUG', SCREEN.w / 2, 14, C.gold, 'center', BIG_FONT);
    write('INVADERS', SCREEN.w / 2, 32, C.pink, 'center', BIG_FONT);
    write('NO BUGS IN PROD', SCREEN.w / 2, 54, C.dim, 'center');
    for (const [art, x, y, points] of legend) {
      ctx.drawImage(art, x, y);
      write(points, x + 14, y, C.text);
    }
    write('; VS THE BUGS', SCREEN.w / 2, 100, C.shot, 'center');
    if (blink) write('FIRE TO PLAY', SCREEN.w / 2, 116, C.text, 'center');
    write('BEST', 36, 130, C.dim);
    write(cache.bestText, 88, 130, C.gold);
  }

  function banner(s: ArcadeState, blink: boolean) {
    if (s.phase === 'cleared') {
      write(cache.waveText, SCREEN.w / 2, 56, C.gold, 'center');
      write('SHIPPED TO PROD!', SCREEN.w / 2, 70, C.ground, 'center');
      write(cache.bonusText, SCREEN.w / 2, 84, C.text, 'center');
    } else if (s.phase === 'playing' && s.phaseTime < 1.2 && s.alive === s.bugs.length) {
      write(cache.waveText, SCREEN.w / 2, 78, C.gold, 'center');
    } else if (s.phase === 'over') {
      ctx.fillStyle = C.shade;
      ctx.fillRect(0, 40, SCREEN.w, 72);
      write('GAME OVER', SCREEN.w / 2, 48, C.pink, 'center');
      write(cache.scoreText, SCREEN.w / 2, 62, C.text, 'center');
      if (s.newBest && blink) write('NEW HIGH SCORE!', SCREEN.w / 2, 78, C.gold, 'center');
      if (s.phaseTime >= RESTART_DELAY) write('FIRE TO RETRY', SCREEN.w / 2, 96, C.text, 'center');
    }
  }

  ctx.textBaseline = 'top';
  ctx.imageSmoothingEnabled = false;

  return {
    draw(s: ArcadeState) {
      refresh(s);
      const blink = Math.floor(s.clock * BLINK) % 2 === 0;
      const shake = s.shake > 0 ? (Math.floor(s.clock * 60) % 2 ? 1 : -1) : 0;
      ctx.setTransform(1, 0, 0, 1, shake, 0);
      ctx.drawImage(bg, 0, 0);
      if (s.phase === 'title') title(s, blink);
      else {
        field(s);
        hud(s);
        banner(s, blink);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
