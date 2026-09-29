import * as THREE from 'three';
import { createAtmosphere } from './atmosphere/index.ts';
import { type AudioChannel, createAudio } from './audio/index.ts';
import { MAX_FRAME_DT, PLAYER } from './config.ts';
import { createEmitter, GameEvent } from './core/events.ts';
import { createInput } from './core/input.ts';
import { createPicker } from './core/picker.ts';
import { createRenderer } from './core/renderer.ts';
import { experiences, profile } from './data.ts';
import { createFollowCamera } from './player/camera.ts';
import { createCharacter } from './player/character.ts';
import { createPlayer } from './player/controller.ts';
import { createUI, type UITarget } from './ui/index.ts';
import { $, fontsReady } from './utils/dom.ts';
import { createWorld } from './world/index.ts';

declare global {
  interface Window {
    /** Internals exposed by `?debug`. */
    cv?: {
      atmosphere: typeof atmosphere;
      audio: typeof audio;
      player: typeof player;
      renderer: typeof renderer;
      scene: typeof scene;
      camera: typeof camera;
      events: typeof events;
      hero: typeof hero;
      ui: typeof ui;
      world: typeof world;
    };
  }
}

// Signs are drawn on canvases, so the pixel font must be loaded before the world is built.
await fontsReady('48px "Press Start 2P"', 2500);

const events = createEmitter();
const { renderer, scene, camera } = createRenderer($('#scene'));
const atmosphere = createAtmosphere(scene);
const world = createWorld(scene, { profile, experiences });
const hero = createCharacter(profile.avatar);
scene.add(hero.root);
// Last scene mutation before the first render: every material must exist by now.
atmosphere.applyFog(scene);

const audio = createAudio(events);
audio.setPlaces(
  world.targets.flatMap(({ exp, door }) => (exp?.emblem ? [{ emblem: exp.emblem, x: door.x, z: door.z }] : [])),
);
const player = createPlayer(world, events);
events.on(GameEvent.CURB, hero.lookBothWays);
// The sheet that completes the tour hides the hero: dance once it closes.
events.on(GameEvent.ACHIEVEMENT, () => {
  const off = events.on(GameEvent.CLOSE, () => {
    off();
    hero.celebrate();
  });
});
const followCamera = createFollowCamera(camera, world);
let active: ReturnType<typeof player.nearest> = null; // the target within reach, if any
let bench: ReturnType<typeof player.nearestBench> = null; // a free bench within reach, if no door is
let arcade: ReturnType<typeof world.nearestArcade> = null; // the free cabinet, if no door or bench is
const SEATED_PROMPT = { type: 'seated', label: '' };

function interact() {
  if (player.state.seated) player.stand();
  else if (active) ui.open(active);
  else if (bench) {
    player.sit(bench);
    // Hidden by the UI itself on STAND / TELEPORT.
    if (bench.exp.anecdote) ui.showThought(bench.exp.anecdote);
  } else if (arcade) {
    player.state.heading = arcade.heading; // face the cabinet, so the camera frames it on the way out
    ui.openArcade();
  }
}

function toggleAudio(channel: AudioChannel) {
  audio.toggle(channel);
  ui.setMuted(audio.muted);
}

const ui = createUI({
  profile,
  experiences,
  targets: world.targets,
  events,
  onInteract: interact,
  onClock: atmosphere.skipToNextPhase,
  onSound: () => toggleAudio('sound'),
  onMusic: () => toggleAudio('music'),
  onTeleport(target) {
    player.teleport(target);
    followCamera.snap();
  },
});
ui.setMuted(audio.muted);

const input = createInput({
  joystick: ui.joystick,
  isEnabled: () => ui.playing,
  arcade: { buttons: ui.arcade.buttons, isActive: () => ui.arcadeOpen },
});
input.onAction((action) => {
  if (action === 'sound' || action === 'music') {
    if (ui.started) toggleAudio(action);
  } else if (ui.arcadeOpen) {
    if (action === 'back') ui.close();
    if (action === 'interact') ui.arcade.press();
  } else if (ui.overlayOpen) {
    if (action === 'back' || action === 'interact') ui.close();
  } else if (ui.playing) {
    if (action === 'interact') interact();
    if (action === 'time') atmosphere.skipToNextPhase();
  }
});

const picker = createPicker({
  canvas: renderer.domElement,
  camera,
  objects: world.clickables,
  isEnabled: () => ui.playing,
  onPick: (target) => ui.open(target as UITarget),
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), MAX_FRAME_DT);
  const t = clock.elapsedTime;

  if (ui.started) player.update(dt, input.movement());
  hero.update(player.state, dt);
  followCamera.update(dt, t, ui.started ? player.state : null);

  const nearby = ui.started ? player.nearest() : null;
  if (nearby && nearby !== active) events.emit(GameEvent.NEAR, nearby);
  active = nearby;
  bench = ui.started && !nearby && !player.state.seated ? player.nearestBench() : null;
  arcade =
    ui.started && !nearby && !bench && !player.state.seated
      ? world.nearestArcade(player.state.pos, PLAYER.arcadeReach)
      : null;
  const prompt = player.state.seated ? SEATED_PROMPT : (active ?? bench ?? arcade);

  const env = atmosphere.update(dt, player.state.pos, camera);
  world.update(dt, t, active, env, player.state);
  audio.setNight(env.night);
  audio.setListener(player.state.pos.x, player.state.pos.z);
  ui.update({ prompt: ui.playing ? prompt : null, progress: world.progressAt(player.state.pos.z), env });
  if (ui.arcadeOpen) ui.arcade.update(dt, input.pad());
  picker.update();
  renderer.render(scene, camera);
});

// `?debug` exposes internals for manual testing and agent verification.
if (new URLSearchParams(location.search).has('debug')) {
  window.cv = { atmosphere, audio, player, renderer, scene, camera, events, hero, ui, world };
}
