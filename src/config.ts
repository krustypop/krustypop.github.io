// Gameplay tuning. World geometry lives in world/layout.ts.

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  backwardFactor: 0.55,
  acceleration: 10,
  turnSpeed: 2.8,
  jumpSpeed: 8.5,
  gravity: 26,
  radius: 0.45,
  reach: 3.4, // distance at which a door can be entered
  benchReach: 2.2,
  arcadeReach: 1.5, // inside the walk-in bay only, not from the sidewalk
  strideRate: 1.7, // walk-cycle radians per unit travelled
};

export const CAMERA = {
  distance: 7.5,
  height: 4.2,
  lookAhead: 3,
  lookHeight: 1.6,
  followRate: 4,
  introRate: 1.5,
  // Seated: looking up at the building across the street, above the bistro's awning (3.6 at the facade).
  seated: { back: 1.2, height: 4.2, look: 18, lookHeight: 7 },
};

export const MAX_FRAME_DT = 0.05; // clamps long frames (tab switch) so physics never jumps
