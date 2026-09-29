import { clamp } from '../utils/math.ts';
import { WALK_HALF } from './layout.ts';
import type { XZ } from './types.ts';

/** Floor area of a walk-in space behind a facade, open on the avenue side. */
export interface Room {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Colliders {
  add: (x: number, z: number, r: number) => void;
  addRoom: (room: Room) => void;
  resolve: (pos: XZ, radius: number) => void;
}

interface Area extends Room {
  // The open side reaches past the facade by the radius, so the room joins the strip without a gap.
  open: -1 | 0 | 1;
}

// Squared distance from pos to its projection into `area` shrunk by `r`; writes the projection to `out`.
function project(area: Area, pos: XZ, r: number, out: XZ) {
  out.x = clamp(pos.x, area.minX + (area.open === -1 ? -r : r), area.maxX - (area.open === 1 ? -r : r));
  out.z = clamp(pos.z, area.minZ + r, area.maxZ - r);
  return (out.x - pos.x) ** 2 + (out.z - pos.z) ** 2;
}

// The walkable area is the strip between the facades plus any rooms, dotted with round obstacles.
export function createColliders({ minZ, maxZ }: { minZ: number; maxZ: number }): Colliders {
  const circles: { x: number; z: number; r: number }[] = [];
  const rooms: Area[] = [];
  const spot = { x: 0, z: 0 };
  const best = { x: 0, z: 0 };

  return {
    add(x: number, z: number, r: number) {
      circles.push({ x, z, r });
    },

    addRoom(room: Room) {
      const open = room.minX >= WALK_HALF - 1e-6 ? -1 : room.maxX <= -WALK_HALF + 1e-6 ? 1 : 0;
      rooms.push({ ...room, open });
    },

    resolve(pos: XZ, radius: number) {
      best.x = clamp(pos.x, -WALK_HALF + radius, WALK_HALF - radius);
      best.z = clamp(pos.z, minZ, maxZ);
      // Nearest point of the union: the player slides along walls and rounds door jambs.
      let bestD = (best.x - pos.x) ** 2 + (best.z - pos.z) ** 2;
      for (const room of rooms) {
        if (bestD === 0) break;
        const d = project(room, pos, radius, spot);
        if (d < bestD) {
          bestD = d;
          best.x = spot.x;
          best.z = spot.z;
        }
      }
      pos.x = best.x;
      pos.z = best.z;
      for (const c of circles) {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = radius + c.r;
        if (d < min && d > 1e-4) {
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
      }
    },
  };
}
