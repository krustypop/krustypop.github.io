import { describe, expect, test } from 'bun:test';
import {
  bombDelay,
  bombSpeed,
  BUG,
  CELL,
  bugX,
  bugY,
  CLEARED_TIME,
  COLS,
  createBugInvaders,
  DYING_TIME,
  EXTRA_LIFE_AT,
  formationTop,
  HERO,
  marchInterval,
  maxBombs,
  type Pad,
  POINTS,
  RESTART_DELAY,
  ROWS,
  SCREEN,
  SHIELD,
  SHOT,
  START_LIVES,
} from '../src/ui/arcadeGame.ts';
import { rng } from '../src/utils/random.ts';

const idle: Pad = { left: false, right: false, fire: false };
const firing: Pad = { left: false, right: false, fire: true };
const DT = 1 / 60;

function playing(seed = 1) {
  const game = createBugInvaders(rng(seed), 500);
  game.press();
  return game;
}

// Runs the game until `done` or `seconds` elapse; returns true if `done` was reached.
function run(game: ReturnType<typeof createBugInvaders>, seconds: number, pad: Pad, done = () => false) {
  for (let t = 0; t < seconds; t += DT) {
    game.step(DT, pad);
    if (done()) return true;
  }
  return false;
}

// Moves the next shot right under a bug, so it hits on the next step.
function aimAt(game: ReturnType<typeof createBugInvaders>, index: number) {
  const s = game.state;
  const bug = s.bugs[index];
  s.fireCooldown = 0;
  game.step(DT, firing);
  const shot = s.shots.find((p) => p.alive)!;
  shot.x = bugX(s, bug.col) + 4;
  shot.y = bugY(s, bug.row) + 4;
}

describe('bug invaders: a run', () => {
  test('starts on the title screen and a press starts a full wave', () => {
    const game = createBugInvaders(rng(1), 0);
    expect(game.state.phase).toBe('title');
    game.step(DT, firing);
    const s = game.state;
    expect(s.phase).toBe('playing');
    expect(s.alive).toBe(COLS * ROWS);
    expect(s.lives).toBe(START_LIVES);
    expect(s.score).toBe(0);
    expect(s.fx.start).toBe(true);
  });

  test('the hero moves with the pad and stays on screen', () => {
    const game = playing();
    run(game, 5, { ...idle, left: true });
    expect(game.state.heroX).toBeGreaterThanOrEqual(0);
    expect(game.state.heroX).toBeLessThan(10);
    run(game, 5, { ...idle, right: true });
    expect(game.state.heroX + HERO.w).toBeLessThanOrEqual(SCREEN.w);
  });

  test('one semicolon at a time, a coffee allows a burst', () => {
    const game = playing();
    const s = game.state;
    s.bombTimer = 99;
    s.heroX = 4; // clear of the bunkers
    run(game, 0.5, firing);
    expect(s.shots.filter((p) => p.alive).length).toBeLessThanOrEqual(1);
    s.coffee = 5;
    let most = 0;
    run(game, 0.5, firing, () => {
      most = Math.max(most, s.shots.filter((p) => p.alive).length);
      return false;
    });
    expect(most).toBeGreaterThan(1);
  });
});

describe('bug invaders: scoring', () => {
  test('a hit squashes the bug and scores by row, top rows worth more', () => {
    const game = playing();
    const s = game.state;
    aimAt(game, 0); // top row
    game.step(DT, idle);
    expect(s.bugs[0].alive).toBe(false);
    expect(s.alive).toBe(COLS * ROWS - 1);
    expect(s.score).toBe(POINTS[0]);
    expect(s.fx.hit).toBe(true);
    aimAt(game, (ROWS - 1) * COLS); // bottom row
    game.step(DT, idle);
    expect(s.score).toBe(POINTS[0] + POINTS[ROWS - 1]);
    expect(POINTS[0]).toBeGreaterThan(POINTS[ROWS - 1]);
  });

  test('crossing the threshold grants one extra life, once', () => {
    const game = playing();
    const s = game.state;
    s.score = EXTRA_LIFE_AT - POINTS[0];
    aimAt(game, 0);
    game.step(DT, idle);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.fx.life).toBe(true);
    aimAt(game, 1);
    game.step(DT, idle);
    expect(s.lives).toBe(START_LIVES + 1);
  });

  test('clearing the wave pays a bonus, then the next one starts lower and faster', () => {
    const game = playing();
    const s = game.state;
    for (const b of s.bugs) b.alive = false;
    s.bugs[0].alive = true;
    s.alive = 1;
    aimAt(game, 0);
    game.step(DT, idle);
    expect(s.phase).toBe('cleared');
    expect(s.fx.wave).toBe(true);
    expect(s.score).toBe(POINTS[0] + 50);
    run(game, CLEARED_TIME + 0.1, idle);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(2);
    expect(s.alive).toBe(COLS * ROWS);
    expect(s.formation.y).toBe(formationTop(2));
  });
});

function bombTheHero(game: ReturnType<typeof createBugInvaders>) {
  const s = game.state;
  const bomb = s.bombs[0];
  bomb.alive = true;
  bomb.x = s.heroX + 4;
  bomb.y = HERO.y - 2;
  game.step(DT, idle);
}

describe('bug invaders: lives', () => {
  test('a bomb on the hero costs a life, then the hero respawns', () => {
    const game = playing();
    const s = game.state;
    bombTheHero(game);
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.phase).toBe('dying');
    expect(s.fx.hurt).toBe(true);
    run(game, DYING_TIME + 0.1, idle);
    expect(s.phase).toBe('playing');
  });

  test('losing the last life ends the game and keeps the best score', () => {
    const game = playing();
    const s = game.state;
    s.score = 900;
    s.lives = 1;
    bombTheHero(game);
    let over = false;
    run(game, DYING_TIME + 0.1, idle, () => (over ||= s.fx.over));
    expect(over).toBe(true);
    expect(s.phase).toBe('over');
    expect(s.best).toBe(900);
    expect(s.newBest).toBe(true);
  });

  test('bugs reaching the dev end the game at once', () => {
    const game = playing();
    const s = game.state;
    s.formation.y = HERO.y - (ROWS - 1) * CELL.h - BUG.h;
    s.formation.timer = 0;
    game.step(DT, idle);
    expect(s.phase).toBe('over');
    expect(s.lives).toBe(0);
  });

  test('a held fire button does not skip the game over screen', () => {
    const game = playing();
    const s = game.state;
    s.lives = 1;
    bombTheHero(game);
    run(game, DYING_TIME + 0.1, idle);
    expect(s.phase).toBe('over');
    game.press();
    expect(s.phase).toBe('over');
    run(game, RESTART_DELAY, idle);
    game.step(DT, firing);
    expect(s.phase).toBe('playing');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(START_LIVES);
  });
});

describe('bug invaders: formation and difficulty', () => {
  test('the formation marches sideways, then drops and turns at the edge', () => {
    const game = playing();
    const s = game.state;
    s.bombTimer = 99;
    const { x, y } = s.formation;
    run(game, 1, idle);
    expect(s.formation.x).toBeGreaterThan(x);
    expect(s.formation.y).toBe(y);
    run(game, 20, idle, () => s.formation.dir === -1);
    expect(s.formation.y).toBeGreaterThan(y);
  });

  test('fewer bugs and later waves march faster', () => {
    expect(marchInterval(1, 32, 1)).toBeLessThan(marchInterval(32, 32, 1) / 5);
    expect(marchInterval(32, 32, 4)).toBeLessThan(marchInterval(32, 32, 1));
  });

  test('later waves drop more, faster bombs, more often', () => {
    expect(maxBombs(5)).toBeGreaterThan(maxBombs(1));
    expect(bombSpeed(5)).toBeGreaterThan(bombSpeed(1));
    expect(bombDelay(5, 0.5)).toBeLessThan(bombDelay(1, 0.5));
    expect(formationTop(3)).toBeGreaterThan(formationTop(1));
  });

  test('bugs drop bombs on their own', () => {
    const game = playing(7);
    const s = game.state;
    expect(run(game, 5, idle, () => s.bombs.some((b) => b.alive))).toBe(true);
  });

  test('bunkers stop semicolons and wear down', () => {
    const game = playing();
    const s = game.state;
    s.bombTimer = 99;
    const solid = () => s.shields[0].reduce((n, c) => n + c, 0);
    const before = solid();
    s.heroX = SHIELD.xs[0] + SHIELD.cols / 2 - HERO.w / 2;
    game.step(DT, firing);
    const shot = s.shots.find((p) => p.alive)!;
    run(game, 0.5, idle, () => !shot.alive);
    expect(shot.alive).toBe(false);
    expect(solid()).toBeLessThan(before);
    expect(s.score).toBe(0);
    expect(SHOT.h).toBeGreaterThan(0);
  });
});
