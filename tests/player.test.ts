import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { createEmitter, GameEvent } from '../src/core/events.ts';
import { createPlayer } from '../src/player/controller.ts';

const bench = { seat: { x: 8.9, z: -22 }, seatY: 0.67, heading: -Math.PI / 2 };
const world = {
  spawn: new THREE.Vector3(0, 0, 16),
  spawnHeading: Math.PI,
  resolve: () => {},
  groundHeight: () => 0,
  nearestTarget: () => null,
  nearestBench: () => bench,
};
const still = { forward: 0, turn: 0, run: false, jump: false };

function seatedPlayer() {
  const events = createEmitter();
  const heard: string[] = [];
  events.on(GameEvent.SIT, () => heard.push('sit'));
  events.on(GameEvent.STAND, () => heard.push('stand'));
  const player = createPlayer(world, events);
  player.sit(bench);
  return { player, heard };
}

describe('bench', () => {
  test('sitting faces the bench heading and holds still', () => {
    const { player, heard } = seatedPlayer();
    player.update(0.1, still);
    expect(player.state.seated).toBe(true);
    expect(player.state.heading).toBe(bench.heading);
    expect(player.state.pos.x).toBe(bench.seat.x);
    expect(heard).toEqual(['sit']);
  });

  test('any move stands up, one step in front of the bench', () => {
    const { player, heard } = seatedPlayer();
    player.update(0.016, { ...still, turn: 1 });
    expect(player.state.seated).toBe(false);
    expect(player.state.pos.x).toBeLessThan(bench.seat.x - 1); // toward the road
    expect(player.state.pos.y).toBe(0);
    expect(heard).toEqual(['sit', 'stand']);
  });

  test('a teleport leaves the bench', () => {
    const { player } = seatedPlayer();
    player.teleport({ stand: { x: 0, z: 0 }, standHeading: 0 });
    expect(player.state.seated).toBe(false);
  });
});
