import type * as THREE from 'three';

const DAY_SECONDS = 480; // one in-game day
const WARP_SPEED = 8; // in-game hours per second when skipping ahead
const PHASES = [6.3, 12, 18.2, 22]; // dawn, noon, sunset, night
const SUNRISE = 6.25;
const TILT_AHEAD = -0.45; // keeps sun and moon ahead of a player walking toward -Z

export const wrapHour = (h: number) => ((h % 24) + 24) % 24;

export function createDayClock(startHour: number) {
  let hour = wrapHour(startHour);
  let warpTo: number | null = null;

  return {
    get hour() {
      return hour;
    },

    set(h: number) {
      hour = wrapHour(h);
      warpTo = null;
    },

    skipToNextPhase() {
      warpTo = PHASES.find((p) => p > hour + 0.05) ?? PHASES[0];
    },

    tick(dt: number) {
      if (warpTo === null) {
        hour = wrapHour(hour + (dt * 24) / DAY_SECONDS);
        return hour;
      }
      const left = wrapHour(warpTo - hour);
      const step = WARP_SPEED * dt;
      if (left <= step + 1e-9) {
        hour = warpTo;
        warpTo = null;
      } else {
        hour = wrapHour(hour + step);
      }
      return hour;
    },
  };
}

/** Sun and moon on opposite sides of a circle, rising in the east (+X). */
export function celestialDirections(hour: number, sun: THREE.Vector3, moon: THREE.Vector3) {
  const a = ((hour - SUNRISE) / 24) * Math.PI * 2;
  sun.set(Math.cos(a), Math.sin(a), TILT_AHEAD).normalize();
  moon.set(-Math.cos(a), -Math.sin(a), TILT_AHEAD).normalize();
}
