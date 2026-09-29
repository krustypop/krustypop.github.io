import type { Rng } from '../utils/random.ts';

// “Bug Invaders”: a formation of bugs marches down on the dev, who answers with semicolons.
// Pure rules on a 160 × 144 pixel screen; ui/arcade.ts feeds input and draws the state.

export const SCREEN = { w: 160, h: 144 } as const;
export const HUD_H = 11; // score line at the top
export const GROUND_Y = 136;
export const COLS = 8;
export const ROWS = 4;
export const CELL = { w: 14, h: 11 } as const;
export const BUG = { w: 10, h: 8 } as const;
export const POINTS = [30, 20, 20, 10] as const; // by row, top first
export const HERO = { w: 11, h: 7, y: 124, speed: 72 } as const;
export const SHOT = { w: 2, h: 6, speed: 150, coffeeSpeed: 200, cooldown: 0.28, coffeeCooldown: 0.12 } as const;
export const BOMB = { w: 3, h: 5 } as const;
export const SHIELD = { cols: 18, rows: 9, y: 101, xs: [23, 71, 119] } as const;
export const ATOM = { w: 11, h: 9, y: 13, speed: 34, points: [50, 100, 150] } as const;
export const COFFEE_TIME = 8;
export const EXTRA_LIFE_AT = 1000;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const DYING_TIME = 1.4;
export const CLEARED_TIME = 1.8;
export const RESTART_DELAY = 1; // after game over, so a held fire button doesn't skip the score
const STEP_X = 2;
const DROP_Y = 5;
const EDGE = 3;
const MAX_SHOTS = 3;
const MAX_BOMBS = 6;
const SPLATS = 6;
const ATOM_MIN_BUGS = 6; // no bonus ship once the wave is nearly done
const AIMED_BOMB = 0.35; // share of bombs dropped from the column above the hero

export type Phase = 'title' | 'playing' | 'dying' | 'cleared' | 'over';

export interface Pad {
  left: boolean;
  right: boolean;
  fire: boolean;
}

export interface Bug {
  alive: boolean;
  row: number;
  col: number;
}

export interface Projectile {
  alive: boolean;
  x: number;
  y: number;
}

export interface Splat {
  ttl: number;
  x: number;
  y: number;
  hero: boolean;
}

/** What happened during the last step, for sounds. `march` is the beat index (0..3) or -1. */
export interface ArcadeFx {
  start: boolean;
  shoot: boolean;
  hit: boolean;
  hurt: boolean;
  wave: boolean;
  bonus: boolean;
  life: boolean;
  over: boolean;
  march: number;
}

export interface ArcadeState {
  phase: Phase;
  phaseTime: number;
  clock: number;
  score: number;
  best: number;
  newBest: boolean;
  lives: number;
  wave: number;
  heroX: number;
  bugs: Bug[];
  alive: number;
  formation: { x: number; y: number; dir: 1 | -1; timer: number; beat: number; frame: 0 | 1 };
  shots: Projectile[];
  bombs: Projectile[];
  shields: Uint8Array[];
  atom: { alive: boolean; x: number; dir: 1 | -1; timer: number };
  coffee: number;
  fireCooldown: number;
  bombTimer: number;
  splats: Splat[];
  popup: { ttl: number; x: number; y: number; points: number };
  shake: number;
  extraGiven: boolean;
  fx: ArcadeFx;
}

// Formation step period: the fewer bugs left, the faster they march, and each wave is faster.
export const marchInterval = (alive: number, total: number, wave: number) =>
  (0.03 + (0.5 * alive) / total) * Math.max(0.45, 1 - 0.1 * (wave - 1));
export const bombDelay = (wave: number, r: number) => Math.max(0.28, 1.1 - 0.14 * (wave - 1)) * (0.6 + r * 0.8);
export const maxBombs = (wave: number) => Math.min(MAX_BOMBS, 1 + wave);
export const bombSpeed = (wave: number) => Math.min(95, 42 + 6 * wave);
export const formationTop = (wave: number) => HUD_H + 12 + Math.min(wave - 1, 6) * 4;

export const bugX = (s: ArcadeState, col: number) => s.formation.x + col * CELL.w + (CELL.w - BUG.w) / 2;
export const bugY = (s: ArcadeState, row: number) => s.formation.y + row * CELL.h;

export const overlaps = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// A bunker: flat block with rounded top corners and an arch underneath.
export function freshShield(out: Uint8Array = new Uint8Array(SHIELD.cols * SHIELD.rows)) {
  const { cols, rows } = SHIELD;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const edge = Math.min(x, cols - 1 - x);
      const corner = y < 2 - edge;
      const arch = y >= rows - 3 && edge >= 4 + (rows - 1 - y);
      out[y * cols + x] = corner || arch ? 0 : 1;
    }
  }
  return out;
}

const makeFx = (): ArcadeFx => ({
  start: false,
  shoot: false,
  hit: false,
  hurt: false,
  wave: false,
  bonus: false,
  life: false,
  over: false,
  march: -1,
});

function resetFx(fx: ArcadeFx) {
  fx.start = fx.shoot = fx.hit = fx.hurt = fx.wave = fx.bonus = fx.life = fx.over = false;
  fx.march = -1;
}

const projectiles = (n: number): Projectile[] => Array.from({ length: n }, () => ({ alive: false, x: 0, y: 0 }));

export function createBugInvaders(rand: Rng, best = 0) {
  const s: ArcadeState = {
    phase: 'title',
    phaseTime: 0,
    clock: 0,
    score: 0,
    best,
    newBest: false,
    lives: START_LIVES,
    wave: 1,
    heroX: (SCREEN.w - HERO.w) / 2,
    bugs: Array.from({ length: COLS * ROWS }, (_, i) => ({ alive: false, row: Math.floor(i / COLS), col: i % COLS })),
    alive: 0,
    formation: { x: 0, y: 0, dir: 1, timer: 0, beat: 0, frame: 0 },
    shots: projectiles(MAX_SHOTS),
    bombs: projectiles(MAX_BOMBS),
    shields: SHIELD.xs.map(() => freshShield()),
    atom: { alive: false, x: 0, dir: 1, timer: 0 },
    coffee: 0,
    fireCooldown: 0,
    bombTimer: 0,
    splats: Array.from({ length: SPLATS }, () => ({ ttl: 0, x: 0, y: 0, hero: false })),
    popup: { ttl: 0, x: 0, y: 0, points: 0 },
    shake: 0,
    extraGiven: false,
    fx: makeFx(),
  };
  const extent = { minCol: 0, maxCol: 0, maxRow: 0 };
  let wasFire = false;

  function setPhase(phase: Phase) {
    s.phase = phase;
    s.phaseTime = 0;
  }

  function clearProjectiles() {
    for (const p of s.shots) p.alive = false;
    for (const p of s.bombs) p.alive = false;
    s.atom.alive = false;
  }

  function setupWave() {
    for (const b of s.bugs) b.alive = true;
    s.alive = s.bugs.length;
    const f = s.formation;
    f.x = (SCREEN.w - COLS * CELL.w) / 2;
    f.y = formationTop(s.wave);
    f.dir = 1;
    f.timer = marchInterval(s.alive, s.bugs.length, s.wave);
    f.beat = 0;
    for (const shield of s.shields) freshShield(shield);
    clearProjectiles();
    s.heroX = (SCREEN.w - HERO.w) / 2;
    s.bombTimer = bombDelay(s.wave, rand()) + 1;
    s.atom.timer = 12 + rand() * 8;
    setPhase('playing');
  }

  function start() {
    s.score = 0;
    s.lives = START_LIVES;
    s.wave = 1;
    s.coffee = 0;
    s.newBest = false;
    s.extraGiven = false;
    setupWave();
    s.fx.start = true;
  }

  // E / Enter / a fresh fire press: start from the title, restart once the score has been seen.
  function press() {
    const ready = s.phase === 'title' || (s.phase === 'over' && s.phaseTime >= RESTART_DELAY);
    if (ready) start();
    return ready;
  }

  function addScore(points: number) {
    s.score += points;
    if (!s.extraGiven && s.score >= EXTRA_LIFE_AT) {
      s.extraGiven = true;
      s.lives = Math.min(MAX_LIVES, s.lives + 1);
      s.fx.life = true;
    }
  }

  function splat(x: number, y: number, hero: boolean) {
    const slot = s.splats.find((p) => p.ttl <= 0) ?? s.splats[0];
    slot.ttl = hero ? DYING_TIME : 0.25;
    slot.x = x;
    slot.y = y;
    slot.hero = hero;
  }

  function gameOver() {
    s.lives = 0;
    clearProjectiles();
    s.newBest = s.score > s.best;
    s.best = Math.max(s.best, s.score);
    setPhase('over');
    s.fx.over = true;
  }

  function hurt() {
    s.lives--;
    splat(s.heroX, HERO.y, true);
    s.shake = 0.35;
    s.coffee = 0;
    s.fx.hurt = true;
    clearProjectiles();
    setPhase('dying');
  }

  // Clears a ragged blob of bunker cells around (cx, cy), in shield cells.
  function erode(shield: Uint8Array, cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= SHIELD.cols || y >= SHIELD.rows) continue;
        if (Math.abs(dx) + Math.abs(dy) <= 1 || rand() < 0.45) shield[y * SHIELD.cols + x] = 0;
      }
    }
  }

  // True (and the bunker takes damage) if the rect touches a solid cell.
  function hitShields(x: number, y: number, w: number, h: number) {
    for (let k = 0; k < s.shields.length; k++) {
      const sx = SHIELD.xs[k];
      if (!overlaps(x, y, w, h, sx, SHIELD.y, SHIELD.cols, SHIELD.rows)) continue;
      const shield = s.shields[k];
      const x0 = Math.max(0, Math.floor(x - sx));
      const x1 = Math.min(SHIELD.cols - 1, Math.ceil(x + w - sx) - 1);
      const y0 = Math.max(0, Math.floor(y - SHIELD.y));
      const y1 = Math.min(SHIELD.rows - 1, Math.ceil(y + h - SHIELD.y) - 1);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          if (shield[cy * SHIELD.cols + cx]) {
            erode(shield, cx, cy);
            return true;
          }
        }
      }
    }
    return false;
  }

  function killBug(b: Bug) {
    b.alive = false;
    s.alive--;
    addScore(POINTS[b.row]);
    splat(bugX(s, b.col), bugY(s, b.row), false);
    s.fx.hit = true;
    if (s.alive === 0) {
      addScore(50 * s.wave);
      clearProjectiles();
      setPhase('cleared');
      s.fx.wave = true;
    }
  }

  function moveHero(dt: number, pad: Pad) {
    const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
    s.heroX = Math.min(SCREEN.w - EDGE - HERO.w, Math.max(EDGE, s.heroX + dir * HERO.speed * dt));
  }

  function fire(dt: number, pad: Pad) {
    s.fireCooldown -= dt;
    if (!pad.fire || s.fireCooldown > 0) return;
    const limit = s.coffee > 0 ? MAX_SHOTS : 1;
    let flying = 0;
    let free: Projectile | null = null;
    for (const p of s.shots) {
      if (p.alive) flying++;
      else free ??= p;
    }
    if (!free || flying >= limit) return;
    free.alive = true;
    free.x = s.heroX + (HERO.w - SHOT.w) / 2;
    free.y = HERO.y - SHOT.h;
    s.fireCooldown = s.coffee > 0 ? SHOT.coffeeCooldown : SHOT.cooldown;
    s.fx.shoot = true;
  }

  function shotHits(p: Projectile) {
    for (const b of s.bugs) {
      if (b.alive && overlaps(p.x, p.y, SHOT.w, SHOT.h, bugX(s, b.col), bugY(s, b.row), BUG.w, BUG.h)) {
        killBug(b);
        return true;
      }
    }
    const { atom } = s;
    if (atom.alive && overlaps(p.x, p.y, SHOT.w, SHOT.h, atom.x, ATOM.y, ATOM.w, ATOM.h)) {
      atom.alive = false;
      const points = ATOM.points[Math.floor(rand() * ATOM.points.length)];
      addScore(points);
      s.coffee = COFFEE_TIME;
      s.popup.ttl = 1.2;
      s.popup.x = atom.x;
      s.popup.y = ATOM.y;
      s.popup.points = points;
      s.fx.bonus = true;
      return true;
    }
    for (const bomb of s.bombs) {
      // A semicolon cancels a bomb head-on.
      if (bomb.alive && overlaps(p.x, p.y, SHOT.w, SHOT.h, bomb.x, bomb.y, BOMB.w, BOMB.h)) {
        bomb.alive = false;
        return true;
      }
    }
    return hitShields(p.x, p.y, SHOT.w, SHOT.h);
  }

  function moveShots(dt: number) {
    const speed = s.coffee > 0 ? SHOT.coffeeSpeed : SHOT.speed;
    for (const p of s.shots) {
      if (!p.alive) continue;
      p.y -= speed * dt;
      if (p.y + SHOT.h < HUD_H || shotHits(p)) p.alive = false;
      if (s.phase !== 'playing') return;
    }
  }

  // Columns and lowest row still standing, written to `extent` (called on every march step).
  function measure() {
    extent.minCol = COLS;
    extent.maxCol = -1;
    extent.maxRow = -1;
    for (const b of s.bugs) {
      if (!b.alive) continue;
      extent.minCol = Math.min(extent.minCol, b.col);
      extent.maxCol = Math.max(extent.maxCol, b.col);
      extent.maxRow = Math.max(extent.maxRow, b.row);
    }
    return extent;
  }

  function march(dt: number) {
    const f = s.formation;
    f.timer -= dt;
    if (f.timer > 0) return;
    f.timer = marchInterval(s.alive, s.bugs.length, s.wave);
    const { minCol, maxCol, maxRow } = measure();
    const offset = (CELL.w - BUG.w) / 2;
    const nextX = f.x + f.dir * STEP_X;
    if (nextX + minCol * CELL.w + offset < EDGE || nextX + maxCol * CELL.w + offset + BUG.w > SCREEN.w - EDGE) {
      f.y += DROP_Y;
      f.dir = f.dir === 1 ? -1 : 1;
    } else f.x = nextX;
    f.frame = f.frame ? 0 : 1;
    s.fx.march = f.beat;
    f.beat = (f.beat + 1) % 4;

    // Bugs chew through the bunkers they walk over, and win if they reach the dev.
    for (const b of s.bugs) if (b.alive) hitShields(bugX(s, b.col), bugY(s, b.row), BUG.w, BUG.h);
    if (bugY(s, maxRow) + BUG.h >= HERO.y) {
      splat(s.heroX, HERO.y, true);
      s.fx.hurt = true;
      gameOver();
    }
  }

  // The lowest living bug of a column, or null.
  function bottomOf(col: number) {
    for (let row = ROWS - 1; row >= 0; row--) {
      const b = s.bugs[row * COLS + col];
      if (b.alive) return b;
    }
    return null;
  }

  function dropBombs(dt: number) {
    s.bombTimer -= dt;
    if (s.bombTimer > 0) return;
    s.bombTimer = bombDelay(s.wave, rand());
    let flying = 0;
    let free: Projectile | null = null;
    for (const p of s.bombs) {
      if (p.alive) flying++;
      else free ??= p;
    }
    if (!free || flying >= maxBombs(s.wave)) return;
    const heroCol = Math.round((s.heroX + HERO.w / 2 - s.formation.x - CELL.w / 2) / CELL.w);
    let bug = rand() < AIMED_BOMB && heroCol >= 0 && heroCol < COLS ? bottomOf(heroCol) : null;
    if (!bug) {
      let n = Math.floor(rand() * s.alive);
      for (const b of s.bugs) if (b.alive && n-- === 0) bug = bottomOf(b.col);
    }
    if (!bug) return;
    free.alive = true;
    free.x = bugX(s, bug.col) + (BUG.w - BOMB.w) / 2;
    free.y = bugY(s, bug.row) + BUG.h;
  }

  function moveBombs(dt: number) {
    const speed = bombSpeed(s.wave);
    for (const p of s.bombs) {
      if (!p.alive) continue;
      p.y += speed * dt;
      if (p.y > GROUND_Y || hitShields(p.x, p.y, BOMB.w, BOMB.h)) p.alive = false;
      else if (overlaps(p.x, p.y, BOMB.w, BOMB.h, s.heroX, HERO.y, HERO.w, HERO.h)) {
        hurt();
        return;
      }
    }
  }

  function moveAtom(dt: number) {
    const { atom } = s;
    if (!atom.alive) {
      atom.timer -= dt;
      if (atom.timer > 0 || s.alive < ATOM_MIN_BUGS) return;
      atom.alive = true;
      atom.dir = rand() < 0.5 ? 1 : -1;
      atom.x = atom.dir === 1 ? -ATOM.w : SCREEN.w;
      atom.timer = 16 + rand() * 10;
      return;
    }
    atom.x += atom.dir * ATOM.speed * dt;
    if (atom.x < -ATOM.w || atom.x > SCREEN.w) atom.alive = false;
  }

  return {
    state: s,
    start,
    press,

    // Back to the title screen: walking away from the cabinet abandons the run.
    title() {
      clearProjectiles();
      setPhase('title');
    },

    step(dt: number, pad: Pad) {
      resetFx(s.fx);
      s.clock += dt;
      s.phaseTime += dt;
      s.shake = Math.max(0, s.shake - dt);
      s.popup.ttl -= dt;
      for (const p of s.splats) p.ttl -= dt;
      const fireEdge = pad.fire && !wasFire;
      wasFire = pad.fire;

      switch (s.phase) {
        case 'title':
        case 'over':
          if (fireEdge) press();
          return;
        case 'cleared':
          if (s.phaseTime >= CLEARED_TIME) {
            s.wave++;
            setupWave();
          }
          return;
        case 'dying':
          if (s.phaseTime < DYING_TIME) return;
          if (s.lives > 0) {
            s.heroX = (SCREEN.w - HERO.w) / 2;
            s.bombTimer = bombDelay(s.wave, rand()) + 0.8;
            setPhase('playing');
          } else gameOver();
          return;
        case 'playing':
          s.coffee = Math.max(0, s.coffee - dt);
          moveHero(dt, pad);
          fire(dt, pad);
          moveShots(dt);
          if (s.phase === 'playing') march(dt);
          if (s.phase === 'playing') dropBombs(dt);
          if (s.phase === 'playing') moveBombs(dt);
          if (s.phase === 'playing') moveAtom(dt);
      }
    },
  };
}

export type BugInvaders = ReturnType<typeof createBugInvaders>;
