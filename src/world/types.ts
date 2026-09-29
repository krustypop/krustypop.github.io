export type { Experience as WorldExperience } from '../data.ts';

export interface WorldProfile {
  name: string;
  title: string;
  contact: { message: string };
  family: { firstChild: number };
}

export type Rand = () => number;

/** Position on the ground plane. */
export interface XZ {
  x: number;
  z: number;
}
