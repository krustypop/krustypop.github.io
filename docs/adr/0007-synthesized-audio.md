# 0007 — All sound synthesized with Web Audio

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

The owner asked for footsteps and chiptune music. The site has no build step ([ADR 0001](0001-no-build-step.md)) and should stay light and free of licensing questions. The music should react to the day/night cycle.

## Options

- **Audio files (OGG/MP3):** best fidelity and any style; adds hundreds of KB to MBs, needs sourcing and licenses, and can't be re-mixed live beyond volume.
- **Library (Tone.js):** nicer API; one more CDN dependency for a small need.
- **Raw Web Audio synthesis:** pulse / triangle / noise voices, like an NES; zero bytes of assets, the mix is fully live (night filter, drum level), and the song is data.

## Decision

Raw Web Audio. The song is written as note strings in `audio/song.ts`, played by a look-ahead sequencer. Effects are small synth recipes triggered by `GameEvent`s.

## Consequences

- No asset pipeline; the music is editable as text and testable (`tests/music.test.ts`).
- The style is limited to chip sounds. Anything realistic would need samples.
- The `AudioContext` is created inside the Start gesture (autoplay policy), and audio only listens to events ([pattern 003](../patterns/003-event-bus.md), [guide 004](../guides/004-audio.md)).
- Nothing can be verified by ear in the agent's browser: check with analyser levels and event counts.

## Revisit when

- A soundtrack or effects need real recordings, or the owner wants a non-chiptune style.
