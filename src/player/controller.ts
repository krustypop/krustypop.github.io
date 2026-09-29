import * as THREE from 'three';
import { PLAYER } from '../config.ts';
import { type Emitter, GameEvent } from '../core/events.ts';
import { damp } from '../utils/math.ts';

export interface PlayerState {
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  vy: number;
  grounded: boolean;
  phase: number;
  seated: boolean;
}

export interface Intent {
  turn: number;
  forward: number;
  run: boolean;
  jump: boolean;
}

/** The slice of the world the player collides with and queries. */
export interface PlayerWorld<T, B extends Seat = Seat> {
  spawn: THREE.Vector3;
  spawnHeading: number;
  resolve(pos: THREE.Vector3, radius: number): void;
  groundHeight(x: number): number;
  nearestTarget(pos: THREE.Vector3, reach: number): T | null;
  nearestBench(pos: THREE.Vector3, reach: number): B | null;
  onCrosswalk?(pos: THREE.Vector3): boolean;
  crosswalkFoot?(pos: THREE.Vector3): -1 | 0 | 1;
}

export interface Seat {
  seat: { x: number; z: number };
  seatY: number;
  heading: number;
}

export interface TeleportTarget {
  stand: { x: number; z: number };
  standHeading: number;
}

const MIN_STEP_SPEED = 1; // below this, shuffling makes no footstep sound
const HIP_TO_SEAT = 0.65; // hip pivot height minus half a leg: the thighs rest on the seat
const STAND_OFF = 1.1; // step forward on standing, clear of the bench's colliders
const FACING_ROAD = 0.5; // within 60° of straight across

/** Tank controls (turn + forward), gravity and collisions; emits step / jump / land / curb / cross events. */
export function createPlayer<T, B extends Seat>(world: PlayerWorld<T, B>, events: Emitter) {
  const state: PlayerState = {
    pos: world.spawn.clone(),
    heading: world.spawnHeading,
    speed: 0,
    vy: 0,
    grounded: true,
    phase: 0,
    seated: false,
  };
  const forward = new THREE.Vector3();
  let looked = false; // at this curb, until the hero leaves it
  let from = 0; // the curb the current crossing started from, 0 when not crossing

  // CURB once per stop at a crosswalk's curb facing the road; CROSS on reaching the far curb without leaving the stripes.
  function cross() {
    const foot = world.crosswalkFoot?.(state.pos) ?? 0;
    if (foot) {
      if (!looked && Math.sin(state.heading) * foot < -FACING_ROAD) {
        looked = true;
        events.emit(GameEvent.CURB);
      }
      if (from === -foot) events.emit(GameEvent.CROSS);
      from = foot;
      return;
    }
    looked = false;
    if (!world.onCrosswalk?.(state.pos)) from = 0;
  }

  function move(dt: number, intent: Intent) {
    state.heading += intent.turn * PLAYER.turnSpeed * dt;
    const topSpeed = intent.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const target = intent.forward * topSpeed * (intent.forward < 0 ? PLAYER.backwardFactor : 1);
    state.speed += (target - state.speed) * damp(PLAYER.acceleration, dt);
    forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    state.pos.addScaledVector(forward, state.speed * dt);
    world.resolve(state.pos, PLAYER.radius);
  }

  function fall(dt: number, jump: boolean) {
    if (jump && state.grounded) {
      state.vy = PLAYER.jumpSpeed;
      state.grounded = false;
      events.emit(GameEvent.JUMP);
    }
    const ground = world.groundHeight(state.pos.x);
    state.vy -= PLAYER.gravity * dt;
    state.pos.y += state.vy * dt;
    if (state.pos.y <= ground) {
      if (!state.grounded) events.emit(GameEvent.LAND);
      state.pos.y = ground;
      state.vy = 0;
      state.grounded = true;
    }
    return ground;
  }

  // A foot lands every half walk cycle.
  function stride(dt: number, ground: number) {
    const before = Math.floor(state.phase / Math.PI);
    state.phase += Math.abs(state.speed) * dt * PLAYER.strideRate;
    const stepped = Math.floor(state.phase / Math.PI) !== before;
    if (stepped && state.grounded && Math.abs(state.speed) > MIN_STEP_SPEED) {
      events.emit(GameEvent.STEP, {
        surface: ground > 0 ? 'sidewalk' : 'road',
        loudness: Math.min(1, Math.abs(state.speed) / PLAYER.runSpeed + 0.3),
      });
    }
  }

  function sit({ seat, seatY, heading }: Seat) {
    state.pos.set(seat.x, seatY - HIP_TO_SEAT, seat.z);
    state.heading = heading;
    state.speed = state.vy = 0;
    state.grounded = true;
    state.seated = true;
    events.emit(GameEvent.SIT);
  }

  function standUp() {
    if (!state.seated) return;
    state.seated = false;
    forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    state.pos.addScaledVector(forward, STAND_OFF);
    state.pos.y = world.groundHeight(state.pos.x);
    world.resolve(state.pos, PLAYER.radius);
    events.emit(GameEvent.STAND);
  }

  return {
    state,
    sit,
    stand: standUp,

    update(dt: number, intent: Intent) {
      // Any move gets the sitter up; otherwise nothing moves.
      if (state.seated) {
        if (!intent.forward && !intent.turn && !intent.jump) return;
        standUp();
      }
      move(dt, intent);
      stride(dt, fall(dt, intent.jump));
      cross();
    },

    teleport({ stand, standHeading }: TeleportTarget) {
      state.seated = false;
      state.pos.set(stand.x, world.groundHeight(stand.x), stand.z);
      state.heading = standHeading;
      state.speed = 0;
      looked = false;
      from = 0;
      events.emit(GameEvent.TELEPORT);
    },

    // The target whose door is within reach, if any.
    nearest: () => world.nearestTarget(state.pos, PLAYER.reach),
    nearestBench: () => world.nearestBench(state.pos, PLAYER.benchReach),
  };
}
