import { type Emitter, GameEvent } from '../core/events.ts';
import { $, $$ } from '../utils/dom.ts';
import { createArcade } from './arcade.ts';
import { createHud, type HudTarget } from './hud.ts';
import { createJoystick } from './joystick.ts';
import { contactHTML, cvHTML, experienceHTML, type Experience, type Profile } from './templates.ts';
import { createThought } from './thought.ts';
import { createTimeline } from './timeline.ts';

const ACHIEVEMENT_TOAST = '🏆 Achievement unlocked: every job visited!';
const CROSSING_TOAST = '“A good programmer is someone who always looks both ways before crossing a one-way street.”';

// Structural on purpose: the world's targets are passed through untouched.
export interface UITarget {
  type: 'experience' | 'contact';
  exp?: Experience;
  label: string;
  short: string;
  color: string;
  progress: number;
  stand: { x: number; z: number };
  standHeading: number;
}

export interface UIOptions {
  profile: Profile;
  experiences: readonly Experience[];
  targets: UITarget[];
  events: Emitter;
  onTeleport: (target: UITarget) => void;
  onInteract: () => void;
  onClock: () => void;
  onSound: () => void;
  onMusic: () => void;
}

export interface UIFrame {
  prompt: HudTarget | null;
  progress: number;
  env: { hour: number; night: number };
}

function fillProfile(profile: Profile) {
  $$('[data-name]').forEach((n) => (n.textContent = profile.name));
  $$('[data-title]').forEach((n) => (n.textContent = profile.title));
  $('#start-tagline').textContent = profile.tagline;
  document.title = `${profile.name} — CV`;
}

/**
 * Start screen, HUD and the overlays (a target's sheet, the plain-text CV, the arcade cabinet).
 * Game keys are routed by main.ts; this only listens for "any key" on the start screen.
 */
export function createUI({
  profile,
  experiences,
  targets,
  events,
  onTeleport,
  onInteract,
  onClock,
  onSound,
  onMusic,
}: UIOptions) {
  const el = {
    start: $('#start'),
    startButton: $<HTMLButtonElement>('#btn-start'),
    loading: $('#loading'),
    panel: $('#panel'),
    panelSheet: $('#panel .sheet'),
    panelBody: $('#panel-body'),
    cv: $('#cv'),
    cvBody: $('#cv-body'),
    arcade: $('#arcade'),
  };
  const hud = createHud({ onPrompt: onInteract, onClock, onSound, onMusic });
  const timeline = createTimeline({
    track: $('#timeline-track'),
    dot: $('#timeline-dot'),
    targets,
    onSelect: onTeleport,
  });
  const joystick = createJoystick($('#joystick'));
  const thought = createThought($('#thought'));
  const arcade = createArcade({ root: el.arcade, events });
  const experienceCount = targets.filter((t) => t.type === 'experience').length;
  const visited = new Set<UITarget>();
  let started = false;
  let overlay: HTMLElement | null = null;

  fillProfile(profile);
  el.cvBody.innerHTML = cvHTML(profile, experiences);
  hud.setVisited(0, experienceCount);

  function show(o: HTMLElement) {
    if (overlay) overlay.hidden = true;
    o.hidden = false;
    o.querySelector('.sheet')!.scrollTop = 0;
    overlay = o;
    o.querySelector<HTMLElement>('.close')!.focus({ preventScroll: true });
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay = null;
    events.emit(GameEvent.CLOSE);
    if (!started) el.startButton.focus({ preventScroll: true });
  }

  function visit(target: UITarget) {
    if (visited.has(target)) return;
    visited.add(target);
    timeline.markVisited(target);
    hud.setVisited(visited.size, experienceCount);
    if (visited.size === experienceCount) {
      hud.toast(ACHIEVEMENT_TOAST);
      events.emit(GameEvent.ACHIEVEMENT);
    }
  }

  function open(target: UITarget) {
    el.panelSheet.style.setProperty('--c', target.color);
    el.panelBody.innerHTML = target.type === 'contact' ? contactHTML(profile) : experienceHTML(target.exp!);
    show(el.panel);
    events.emit(GameEvent.OPEN, target);
    if (target.type === 'experience') visit(target);
  }

  function openArcade() {
    show(el.arcade);
    arcade.open();
    events.emit(GameEvent.ARCADE_OPEN);
  }

  function begin() {
    if (started) return;
    started = true;
    el.start.hidden = true;
    document.body.classList.add('playing');
    (document.activeElement as HTMLElement | null)?.blur();
    events.emit(GameEvent.START);
  }

  el.startButton.disabled = false;
  el.loading.hidden = true;
  el.startButton.addEventListener('click', begin);
  $$('[data-open-cv]').forEach((b) => b.addEventListener('click', () => show(el.cv)));
  $$('[data-close]').forEach((b) => b.addEventListener('click', close));
  for (const o of [el.panel, el.cv, el.arcade]) o.addEventListener('click', (e) => e.target === o && close());
  // The player stands up on its own (movement, teleport), so the bubble follows the events.
  events.on(GameEvent.STAND, thought.hide);
  events.on(GameEvent.TELEPORT, thought.hide);
  // The owner's favourite quote, once per visit, after the first street crossed on a crosswalk.
  const offCross = events.on(GameEvent.CROSS, () => {
    offCross();
    hud.toast(CROSSING_TOAST);
  });

  // Any key starts, except keys aimed at a focused button or link.
  addEventListener('keydown', (e: KeyboardEvent) => {
    const modified = e.metaKey || e.ctrlKey || e.altKey;
    if (started || overlay || modified || e.code === 'Tab' || (e.target as Element).closest?.('button, a')) return;
    begin();
  });

  return {
    joystick,
    arcade,
    open,
    openArcade,
    close,
    setMuted: hud.setMuted,
    toast: hud.toast,
    showThought: thought.show,
    hideThought: thought.hide,

    get started() {
      return started;
    },
    get overlayOpen() {
      return overlay !== null;
    },
    get arcadeOpen() {
      return overlay === el.arcade;
    },
    // True when game input should move the player.
    get playing() {
      return started && overlay === null;
    },

    update({ prompt, progress, env }: UIFrame) {
      hud.setPrompt(prompt);
      hud.setClock(env);
      timeline.setProgress(progress);
    },
  };
}
