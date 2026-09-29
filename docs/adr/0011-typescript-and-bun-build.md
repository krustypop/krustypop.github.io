# 0011 — TypeScript, transpiled by Bun

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

[ADR 0001](0001-no-build-step.md) kept plain JavaScript and no build, and listed "TypeScript is wanted" as a reason to reopen. The codebase grew to ~2,600 lines of factories passing shapes around (`world`, `atmosphere`, `GameEvent` payloads); tests pin behaviour but not the contracts between layers.

## Options

- **Keep JavaScript + JSDoc types:** no build, but verbose, weaker inference, and annotations drift.
- **`bun build` to `dist/`, three external:** a single small build script; `index.html` keeps its CDN importmap.
- **Full bundle including three.js:** tree-shaking and offline, but drops the CDN cache and rewrites the importmap and the version test.

## Decision

TypeScript in strict mode. Browsers cannot run it, so `server.ts` strips types per request in dev, and `bun run build` (`build.ts`) bundles `src/main.ts` into `dist/main.js` with `three` left external. The static host serves `dist/`.

## Consequences

- Imports use the `.ts` extension (`allowImportingTsExtensions`); `tsc` only type-checks (`noEmit`), Bun emits.
- `bun run check` also runs `tsc`. Shared shapes are exported types next to the factory that owns them.
- The three.js version is still pinned twice (importmap and `package.json`, plus `@types/three` on the same version); `tests/site.test.ts` checks the importmap.
- Deploying now needs `bun run build`; `dist/` is not committed.
- Top-level `await` in `main.ts` still relies on module scripts.

## Revisit when

- Cold-load time is a measured problem: bundle three.js and drop the CDN.
- The build needs more than one entry point or asset processing.
