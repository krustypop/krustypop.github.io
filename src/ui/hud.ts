import { $, onPress } from '../utils/dom.ts';

const TOAST_MS = 4500;
const CLOCK_STEP_MINUTES = 10;

export interface HudTarget {
  type: string;
  label: string;
}

export interface HudOptions {
  onPrompt: () => void;
  onClock: () => void;
  onSound: () => void;
  onMusic: () => void;
}

const PROMPTS: Record<string, (label: string) => string> = {
  contact: () => 'Contact me',
  bench: () => 'Sit down',
  seated: () => 'Stand up',
  arcade: () => 'Play',
};

const AUDIO_LABELS = {
  sound: ['Mute sound (M)', 'Unmute sound (M)'],
  music: ['Mute music (B)', 'Unmute music (B)'],
} as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

// setPrompt and setClock skip unchanged values, so they can run every frame.
export function createHud({ onPrompt, onClock, onSound, onMusic }: HudOptions) {
  const el = {
    prompt: $('#prompt'),
    promptText: $('#prompt-text'),
    clock: $('#clock'),
    sound: $('#sound'),
    music: $('#music'),
    progress: $('#progress'),
    toast: $('#toast'),
  };
  let prompted: HudTarget | null | undefined;
  let clockLabel: string | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  onPress(el.prompt, onPrompt);
  onPress(el.clock, onClock);
  onPress(el.sound, onSound);
  onPress(el.music, onMusic);

  return {
    setPrompt(target: HudTarget | null) {
      if (target === prompted) return;
      prompted = target;
      el.prompt.hidden = !target;
      if (target) el.promptText.textContent = PROMPTS[target.type]?.(target.label) ?? `Enter ${target.label}`;
    },

    setClock({ hour, night }: { hour: number; night: number }) {
      const h = Math.floor(hour);
      const m = Math.floor(((hour - h) * 60) / CLOCK_STEP_MINUTES) * CLOCK_STEP_MINUTES;
      const label = `${night > 0.5 ? '☾' : '☀'} ${pad2(h)}:${pad2(m)}`;
      if (label !== clockLabel) el.clock.textContent = clockLabel = label;
    },

    setMuted(muted: { sound: boolean; music: boolean }) {
      for (const channel of ['sound', 'music'] as const) {
        const label = AUDIO_LABELS[channel][Number(muted[channel])];
        el[channel].setAttribute('aria-pressed', String(muted[channel]));
        el[channel].setAttribute('aria-label', label);
        el[channel].title = label;
      }
    },

    setVisited(count: number, total: number) {
      el.progress.innerHTML = `${count}/${total}<span class="wide"> visited</span>`;
    },

    toast(message: string) {
      el.toast.textContent = message;
      el.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.remove('show'), TOAST_MS);
    },
  };
}
