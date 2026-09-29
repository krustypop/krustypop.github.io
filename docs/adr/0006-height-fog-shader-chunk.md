# 0006 — Height fog injected into three's built-in shaders

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

The owner asked for "volumetric fog" to set the mood at dawn, dusk and night. The scene uses three's built-in materials (Basic, Lambert, Standard) everywhere, and must run on phones.

## Options

- **Raymarched volumetric fog (post-process):** true light shafts and shadowed fog; needs a depth pass and dozens of samples per pixel. Too expensive for phones.
- **Custom materials with fog built in:** full control, but every built-in material would have to be replaced.
- **Override three's `fog_*` shader chunks:** replace the fog code every built-in material already includes. It becomes an analytic height fog with drifting 3D noise sampled at 3 points along the view ray, plus in-scattering toward the sun or moon. Fake "volume" for lamps comes from additive cones.

## Decision

Override the `fog_*` entries of `THREE.ShaderChunk` at import time (`atmosphere/fog.ts`), with one shared uniforms object attached to every material by `applyFog(root)`. `scene.fog` stays a plain `THREE.Fog`, used only to turn `USE_FOG` on and feed `fogColor`. Street lamps get additive light cones and ground glows (`world/lampLights.ts`).

## Consequences

- `atmosphere.applyFog(scene)` runs once in `main.ts`, after the world and the hero exist, before the first render. A material created after it compiles without the shared uniforms: they read as 0, so no fog. Create materials earlier, or call `applyFog` on them.
- New fog parameters: add them to the shared `uniforms`, declare them in `fog_pars_fragment`, and write them in `updateFog()`.
- The vertex chunk uses `transformed` and `instanceMatrix`: fine for Basic, Lambert and Standard meshes. Materials without `transformed` (sprites) need `fog: false`.
- Additive glows set `fog: false`: fogging an additive surface adds fog color and brightens the distance.
- Custom `ShaderMaterial`s (sky, light beams) get no fog; they blend with the horizon themselves.
- A three.js upgrade that renames or restructures the fog chunks breaks fog silently: check dawn and night visually after bumping.
- Fog is not shadowed by buildings, and there are no real light shafts.

## Revisit when

- Target devices can afford a depth-based volumetric pass (WebGPU compute), or real god rays become a requirement.
