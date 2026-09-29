import { esc, onPress } from '../utils/dom.ts';

export interface TimelineTarget {
  progress: number;
  color: string;
  label: string;
  short: string;
}

export interface TimelineOptions<T extends TimelineTarget> {
  track: HTMLElement;
  dot: HTMLElement;
  targets: T[];
  onSelect: (target: T) => void;
}

const MIN_DOT_MOVE = 0.001; // skip style writes when the player hasn't moved along the avenue

/** Bottom bar: one marker per target (click to jump there) and a dot for the player. */
export function createTimeline<T extends TimelineTarget>({ track, dot, targets, onSelect }: TimelineOptions<T>) {
  const markers = new Map<T, HTMLButtonElement>();
  let lastProgress = -1;

  for (const target of targets) {
    const marker = document.createElement('button');
    marker.className = 'marker';
    marker.style.left = `${target.progress * 100}%`;
    marker.style.setProperty('--c', target.color);
    marker.title = target.label;
    marker.setAttribute('aria-label', `Go to ${target.label}`);
    marker.innerHTML = `<span>${esc(target.short)}</span>`;
    onPress(marker, () => onSelect(target));
    track.append(marker);
    markers.set(target, marker);
  }

  return {
    markVisited(target: T) {
      markers.get(target)!.classList.add('visited');
    },

    setProgress(progress: number) {
      if (Math.abs(progress - lastProgress) < MIN_DOT_MOVE) return;
      lastProgress = progress;
      dot.style.left = `${progress * 100}%`;
    },
  };
}
