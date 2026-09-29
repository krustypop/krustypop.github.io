import { type Emitter, GameEvent, type GameEventType } from '../core/events.ts';
import { readFlag, writeFlag } from '../utils/storage.ts';
import { startSequencer } from './sequencer.ts';
import type { Place } from './ambience.ts';
import { SFX, type SfxName, type StepPayload } from './sfx.ts';
import { startSoundscape, type Surroundings } from './soundscape.ts';
import { createSynth, type Synth } from './synth.ts';

// Everything is synthesized with Web Audio: no audio files to load or license.
const MUSIC_VOLUME = 0.45;
const FADE_IN = 0.8;
// The sound key predates the music toggle, so it keeps its name.
const STORAGE_KEYS = { sound: 'cv-avenue:muted', music: 'cv-avenue:music-muted' } as const;
const ACHIEVEMENT_DELAY = 0.35; // lets the panel-open jingle finish first
const NIGHT_EPSILON = 0.02;
const ARCADE_DUCK = 0.25; // the cabinet's own chiptune takes over while it is open

/** `sound` covers the effects and the ambience; `music` the song. */
export type AudioChannel = keyof typeof STORAGE_KEYS;

const EVENT_SOUNDS: Partial<Record<GameEventType, SfxName>> = {
  [GameEvent.STEP]: 'step',
  [GameEvent.JUMP]: 'jump',
  [GameEvent.LAND]: 'land',
  [GameEvent.SIT]: 'land',
  [GameEvent.NEAR]: 'near',
  [GameEvent.OPEN]: 'open',
  [GameEvent.CLOSE]: 'close',
  [GameEvent.TELEPORT]: 'teleport',
  [GameEvent.ARCADE_OPEN]: 'arcadeCoin',
  [GameEvent.ARCADE_START]: 'arcadeStart',
  [GameEvent.ARCADE_SHOOT]: 'arcadeShoot',
  [GameEvent.ARCADE_HIT]: 'arcadeHit',
  [GameEvent.ARCADE_HURT]: 'arcadeHurt',
  [GameEvent.ARCADE_MARCH]: 'arcadeMarch',
  [GameEvent.ARCADE_WAVE]: 'arcadeWave',
  [GameEvent.ARCADE_BONUS]: 'arcadeBonus',
  [GameEvent.ARCADE_OVER]: 'arcadeOver',
};

export function createAudio(events: Emitter) {
  let synth: Synth | null = null;
  const muted = { sound: readFlag(STORAGE_KEYS.sound), music: readFlag(STORAGE_KEYS.music) };
  let ducked = false;
  let lastNight = -1;
  const around: Surroundings = { places: [], listener: { x: 0, z: 0 }, night: 0, muted: muted.sound };

  const allMuted = () => muted.sound && muted.music;
  const musicLevel = () => (muted.music ? 0 : MUSIC_VOLUME * (ducked ? ARCADE_DUCK : 1));
  const fadeMusic = (tau: number) => synth?.bus.music.gain.setTargetAtTime(musicLevel(), synth.ctx.currentTime, tau);

  const play = (sound: SfxName, payload?: unknown, delay = 0) => {
    if (synth && !muted.sound) SFX[sound](synth, synth.ctx.currentTime + delay, payload as StepPayload);
  };

  // The browser only allows audio after a user gesture; START is emitted from the Start click/key.
  events.on(GameEvent.START, () => {
    if (synth) return;
    synth = createSynth();
    fadeMusic(FADE_IN);
    startSequencer(synth);
    startSoundscape(synth, around);
    if (allMuted()) synth.ctx.suspend();
  });
  for (const [event, sound] of Object.entries(EVENT_SOUNDS) as [GameEventType, SfxName][]) {
    events.on(event, (payload) => play(sound, payload));
  }
  events.on(GameEvent.ACHIEVEMENT, () => play('achievement', null, ACHIEVEMENT_DELAY));

  const duckMusic = (on: boolean) => {
    ducked = on;
    fadeMusic(0.3);
  };
  events.on(GameEvent.ARCADE_OPEN, () => duckMusic(true));
  events.on(GameEvent.CLOSE, () => ducked && duckMusic(false));

  // Hidden tabs throttle timers, which would make the music stutter.
  document.addEventListener('visibilitychange', () => {
    if (!synth || allMuted()) return;
    if (document.hidden) synth.ctx.suspend();
    else synth.ctx.resume();
  });

  return {
    muted: muted as Readonly<typeof muted>,

    // With both channels off, the context is suspended so the sequencer and the soundscape stop too.
    toggle(channel: AudioChannel) {
      muted[channel] = !muted[channel];
      writeFlag(STORAGE_KEYS[channel], muted[channel]);
      around.muted = muted.sound;
      fadeMusic(0.05);
      if (allMuted()) synth?.ctx.suspend();
      else if (!document.hidden) synth?.ctx.resume();
    },

    /** Buildings with a local ambience, heard near their door. */
    setPlaces(places: readonly Place[]) {
      around.places = places;
    },

    // Read by the soundscape on its own tick, so a plain store is enough.
    setListener(x: number, z: number) {
      around.listener.x = x;
      around.listener.z = z;
    },

    // Night muffles the music, softens the drums and swaps birds for crickets.
    setNight(night: number) {
      around.night = night;
      if (!synth || Math.abs(night - lastNight) < NIGHT_EPSILON) return;
      lastNight = night;
      const { ctx, bus } = synth;
      bus.filter.frequency.setTargetAtTime(14000 - night * 11500, ctx.currentTime, 0.5);
      bus.drums.gain.setTargetAtTime(1 - night * 0.6, ctx.currentTime, 0.5);
      bus.arp.gain.setTargetAtTime(1 - night * 0.4, ctx.currentTime, 0.5);
    },
  };
}
