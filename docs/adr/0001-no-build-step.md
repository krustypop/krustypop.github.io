# 0001 — No build step: native ES modules and a CDN importmap

- **Status:** Superseded by [0011](0011-typescript-and-bun-build.md)
- **Date:** 2026-09-28

## Context

A personal CV site, edited by one person, often with an agent. It must deploy as static files anywhere (GitHub Pages, Netlify) and stay easy to change without tooling knowledge. Its only runtime dependency is three.js.

## Options

- **Bundler (Vite, esbuild):** tree-shaking, TypeScript, hot reload, npm imports. Costs a build pipeline, config, and a `dist/` to deploy.
- **Native ES modules + importmap to a CDN (jsDelivr):** zero build, files served as written, three.js cached by the CDN. No tree-shaking, no TypeScript, one pinned URL per dependency.

## Decision

Native ES modules. `index.html` maps `three` and `three/addons/` to `cdn.jsdelivr.net/npm/three@<version>`; `src/` is served as is by `server.js` or any static host.

## Consequences

- The three.js version is pinned twice: in the importmap, and as a devDependency used only by `bun test` and editor types. `tests/site.test.js` fails if they diverge; bump both together.
- The site needs network access to the CDN on first load.
- Plain JavaScript: no types, so behaviour is pinned by tests ([pattern 004](../patterns/004-pure-core.md)).
- Top-level `await` in `main.js` (waiting for the pixel font) relies on module scripts.

## Revisit when

- A second non-trivial dependency arrives, or bundle size / cold-load time becomes a measured problem.
- TypeScript is wanted.
- The site must work offline, or the CDN is unreachable for the audience.
