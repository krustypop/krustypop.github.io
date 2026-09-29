export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const clamp1 = (v: number) => clamp(v, -1, 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Frame-rate independent blend factor: `value += (target - value) * damp(rate, dt)`.
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
