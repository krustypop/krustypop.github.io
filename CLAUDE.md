# CV avenue

A personal CV played as a voxel third-person game: each building on the avenue is a job. Three.js, strict TypeScript, no bundler in dev (Bun strips types per request), `bun run build` emits `dist/`. All UI copy is English.

## Read on demand

Before writing code, read every doc whose trigger matches the change.

**Patterns** (`docs/patterns/`): recurring solutions, applied wherever the case comes up.

- [001 factory modules](docs/patterns/001-factory-modules.md): adding a module that holds state or owns scene objects.
- [002 dependency layers](docs/patterns/002-dependency-layers.md): adding an import or a folder, or connecting two systems.
- [003 event bus](docs/patterns/003-event-bus.md): making one system react to a gameplay moment in another.
- [004 pure core](docs/patterns/004-pure-core.md): writing rules, math, timing or placement logic, and its tests.
- [005 static merge](docs/patterns/005-static-merge.md): adding scenery or materials, or anything that moves, animates or is clicked.
- [006 instanced batch](docs/patterns/006-instanced-batch.md): repeating one small mesh across many buildings.
- [007 seeded generation](docs/patterns/007-seeded-generation.md): placing or varying anything randomly, or reordering generation code.
- [008 time of day](docs/patterns/008-time-of-day.md): anything that changes between day and night.

**Guides** (`docs/guides/`): how one specific subsystem works and how to extend it.

- [001 frame loop](docs/guides/001-frame-loop.md): adding per-frame work.
- [002 input routing](docs/guides/002-input-routing.md): adding a key, a button or touch control.
- [003 CV content](docs/guides/003-cv-content.md): changing CV content or its fields.
- [004 audio](docs/guides/004-audio.md): adding a sound or editing the music.
- [005 arcade](docs/guides/005-arcade.md): the arcade shop, its playable cabinet, or adding a game.

**ADRs** (`docs/adr/`): why the architecture is what it is. Read the matching ADR before questioning or replacing one of these choices; to change one, write a new ADR that supersedes it ([template](docs/adr/0000-template.md)).

- [0001](docs/adr/0001-no-build-step.md) no bundler: native modules + CDN importmap (superseded by 0011)
- [0002](docs/adr/0002-threejs.md) Three.js rather than a heavier engine
- [0003](docs/adr/0003-tank-controls.md) tank controls with a trailing camera
- [0004](docs/adr/0004-reproducible-city.md) seeded, reproducible city
- [0005](docs/adr/0005-merged-static-geometry.md) merged static geometry and instancing
- [0006](docs/adr/0006-height-fog-shader-chunk.md) height fog injected into three's shaders, not volumetric raymarching
- [0007](docs/adr/0007-synthesized-audio.md) all sound synthesized, no audio files
- [0008](docs/adr/0008-layered-systems-event-bus.md) layered systems, injection and an event bus
- [0009](docs/adr/0009-factory-functions.md) factory functions, no classes
- [0010](docs/adr/0010-bun-and-oxc-toolchain.md) Bun, oxlint and oxfmt
- [0011](docs/adr/0011-typescript-and-bun-build.md) TypeScript, transpiled by Bun; `dist/` build with three external

New docs take the next number in their folder (`NNN-name.md` for patterns and guides, `NNNN-name.md` for ADRs) and a line here.

## Done bar

`bun run check` passes: formatting (code and Markdown), lint with zero warnings, `tsc`, tests. A PostToolUse hook (`scripts/claude-post-edit.sh`) already formats every edited file and returns oxlint problems as hook feedback; fix them before moving on.

Visual changes also need an in-browser check: start the `cv-avenue` preview (`.claude/launch.json`, port 4100) and open `/?debug`, which exposes `window.cv` (`atmosphere`, `player`, `hero`, `world` (incl. `world.life`), `ui`, `audio`, `events`, `renderer`, `scene`, `camera`).

- The hidden Browser pane throttles rendering to ~2 fps, so screenshots lag seconds behind state. Read DOM/JS state rather than trusting a single screenshot.
- Drive state through `window.cv`: `atmosphere.setHour(h)`, `player.state.pos`, `ui.open(target)`; `renderer.info.render.calls` for draw calls.
- Audio cannot be heard: patch `window.AudioContext` before clicking Start, tap the destination with an `AnalyserNode`, and read peak/RMS. Subscribe to `cv.events` to check which sounds fire.

## Sandbox gotchas

- oxlint, oxfmt (Rust), `tsc` and proto's `node` panic inside the macOS sandbox (`system-configuration` / SCDynamicStore). The `bun run check|lint|format` scripts are listed in `sandbox.excludedCommands`; any other invocation of these binaries must run unsandboxed.
- `bun add` in the sandbox needs `BUN_TMPDIR="$TMPDIR" BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache"`.

## Other constraints

- Bump three.js in the `index.html` importmap and in `package.json` together and keep `@types/three` on the same version ([ADR 0011](docs/adr/0011-typescript-and-bun-build.md)); `tests/site.test.ts` enforces the importmap.
- Tuning lives in `config.ts` (gameplay) and `world/layout.ts` (geometry).
- Offset coplanar faces by ≥ 0.02: the sidewalk flicker was z-fighting between curb and sidewalk.
