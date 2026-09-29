# 004 — Audio

**Use when** adding a sound effect, changing the music or the ambience, or touching the mix.

**Why:** [ADR 0007](../adr/0007-synthesized-audio.md).

## Rule

Audio is a listener only: it reacts to `GameEvent`s ([pattern 003](../patterns/003-event-bus.md)) and never drives gameplay.

## Layout

| File                   | Role                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `audio/song.ts`        | pure data: tempo, chords, melody (`'E5:4 A4:2 …'`, one bar per string, 16 sixteenths)  |
| `audio/synth.ts`       | `AudioContext`, mixer buses, the `tone()` and `noise()` voices                         |
| `audio/sequencer.ts`   | look-ahead scheduler: a 25 ms timer queues notes 150 ms ahead on the audio clock       |
| `audio/sfx.ts`         | `SFX` table: `name(synth, startTime, payload)`                                         |
| `audio/ambience.ts`    | pure: distance → gain, day/night mix, when a one-shot is due                           |
| `audio/ambient-sfx.ts` | one-shot recipes per building `emblem`, plus birds and crickets, each with its cadence |
| `audio/soundscape.ts`  | 100 ms timer queuing those one-shots 250 ms ahead on the `ambience` bus                |
| `audio/index.ts`       | lifecycle, the two mute channels, event → sound map, night mix                         |

## How

- New effect:
  1. Add `SFX.name` built from `tone` / `noise` on `bus.sfx`.
  2. Map its event in `EVENT_SOUNDS` (or call `play()` for special timing, as `ACHIEVEMENT` does with a delay).
- Ambience: `main.ts` calls `audio.setPlaces()` once (each experience's `emblem` and door) and `audio.setListener(x, z)` each frame; `setNight` also crossfades birds into crickets. A place is silent beyond 15 m of its door and full within 4 m (`placeGain`). New building sound: add its `Emblem` to `PLACE_AMBIENCE`; `tests/audio.test.ts` checks cadence and volume.
- Melody edits: keep each bar at exactly 16 sixteenths; `tests/music.test.ts` checks it.
- Schedule on the audio clock (`t + offset`), never with `setTimeout`.
- Keep ambience sparse: one-shots at a cadence of seconds, never a continuous oscillator.

## Pitfalls

- The `AudioContext` is created on `GameEvent.START`, inside the Start gesture; creating it earlier leaves it suspended by the autoplay policy.
- Two mute channels: `sound` (effects and ambience) and `music` (the music bus gain). Only muting both suspends the context (the sequencer and the soundscape pause with it, since they follow the audio clock). Hidden tabs suspend it too, because throttled timers would make the music stutter.
- Nothing can be heard in the agent's browser: verify with an `AnalyserNode` and event counts (see "Done bar" in `CLAUDE.md`).
