# 008 — Time-of-day propagation

**Use when** something should look or sound different by day and by night.

## Rule

`atmosphere` owns time. Each frame `atmosphere.update()` returns `env = { hour, night }` (`night` ∈ [0, 1] from the palette keyframes); `main.ts` hands `env` to every system that reacts. Systems never read the clock themselves.

## How

- Visuals: add the material to `createCityMaterials()` (`world/materials.ts`) with a `[day, night]` color pair and blend it in `setNight`:
  ```js
  const LAMP_BULB = [new THREE.Color('#d9d4c4'), new THREE.Color('#fff0c0')];
  mats.lampBulb.color.lerpColors(...LAMP_BULB, night);
  ```
- Self-lit `MeshBasicMaterial` that should fade instead of glow at night: `mats.dimAtNight(material)`.
- Non-material effects expose their own `setNight(night)` (`lampLights`, `audio`), called from `world.update` or `main.ts`.
- New palette values (a color, a fog amount): add a column to every `KEYS` row in `atmosphere/palette.ts`, list it in `COLOR_KEYS` or `NUMBER_KEYS`, and read it from `palette`.

## Pitfalls

- Guard with an epsilon: `setNight` skips work when `night` barely moved (0.001 for materials, 0.02 for audio automation).
- Keep `KEYS` hand-aligned under `// prettier-ignore`; the test requires hours 0 → 24, increasing.
- Test at fixed hours via `/?debug` → `cv.atmosphere.setHour(22)`.
