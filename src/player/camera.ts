import * as THREE from 'three';
import { CAMERA } from '../config.ts';
import { damp } from '../utils/math.ts';
import type { PlayerState } from './controller.ts';

/** The slice of the world the camera reads. */
export interface CameraWorld {
  spawn: THREE.Vector3;
  clampCamera(v: THREE.Vector3): void;
}

/** Third-person camera behind the player, or a slow establishing shot while there is none. */
export function createFollowCamera(camera: THREE.Camera, world: CameraWorld) {
  const goal = new THREE.Vector3();
  const lookGoal = new THREE.Vector3();
  const look = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let snap = true;

  function behind(player: Pick<PlayerState, 'pos' | 'heading' | 'seated'>) {
    forward.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    if (player.seated) {
      const { back, height, look: ahead, lookHeight } = CAMERA.seated;
      goal.copy(player.pos).addScaledVector(forward, -back);
      goal.y = player.pos.y + height;
      lookGoal.copy(player.pos).addScaledVector(forward, ahead);
      lookGoal.y = lookHeight;
      return;
    }
    goal.copy(player.pos).addScaledVector(forward, -CAMERA.distance);
    goal.y = player.pos.y + CAMERA.height;
    lookGoal.copy(player.pos).addScaledVector(forward, CAMERA.lookAhead);
    lookGoal.y = player.pos.y + CAMERA.lookHeight;
  }

  function establishing(t: number) {
    goal.set(Math.sin(t * 0.15) * 4, 9 + Math.sin(t * 0.3), world.spawn.z + 12);
    lookGoal.set(0, 3, world.spawn.z - 40);
  }

  return {
    // Jump straight to the goal next frame (after a teleport) instead of flying through buildings.
    snap() {
      snap = true;
    },

    update(dt: number, t: number, player: Pick<PlayerState, 'pos' | 'heading' | 'seated'> | null) {
      if (player) behind(player);
      else establishing(t);
      world.clampCamera(goal);
      const k = snap ? 1 : damp(player ? CAMERA.followRate : CAMERA.introRate, dt);
      camera.position.lerp(goal, k);
      look.lerp(lookGoal, k);
      camera.lookAt(look);
      snap = false;
    },
  };
}
