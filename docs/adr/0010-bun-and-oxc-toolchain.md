# 0010 — Bun and Oxc as the toolchain

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

With no build step ([ADR 0001](0001-no-build-step.md)), tooling is only needed for serving, testing, linting and formatting. The owner asked for Bun as the dev server, and for oxlint and oxfmt.

## Options

- **Node + ESLint + Prettier (+ Vitest):** the mainstream stack; more packages and config, and slower.
- **Bun + oxlint + oxfmt:** one runtime for serving (`Bun.serve`) and testing (`bun test`), plus fast Rust linting and formatting with Prettier-compatible output.

## Decision

Bun runs `server.ts` (port 4100) and the tests. oxlint (`--deny-warnings`) and oxfmt enforce style. `tsc` type-checks ([ADR 0011](0011-typescript-and-bun-build.md)). `bun run check` is the gate, and a Claude Code PostToolUse hook formats and lints every edited file.

## Consequences

- The Rust binaries (oxlint, oxfmt) panic inside the macOS agent sandbox, and `bun add` needs its temp dirs redirected there: the workarounds are in `CLAUDE.md` → Sandbox gotchas.
- oxfmt honours `// prettier-ignore` (used for hand-aligned tables) and also formats Markdown, so docs are part of `check`.
- Bun's HTML dev server (`bun index.html`) is not used: it would try to bundle and resolve `three` locally instead of via the importmap.

## Revisit when

- oxfmt (pre-1.0) diverges from Prettier in ways that hurt, or a needed lint rule exists only in ESLint.
