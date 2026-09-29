// Gameplay moments other systems react to (audio today); emitters don't know who listens.
export const GameEvent = Object.freeze({
  START: 'start',
  STEP: 'player:step',
  JUMP: 'player:jump',
  LAND: 'player:land',
  TELEPORT: 'player:teleport',
  SIT: 'player:sit',
  STAND: 'player:stand',
  CURB: 'player:curb',
  CROSS: 'player:cross',
  NEAR: 'target:near',
  OPEN: 'panel:open',
  CLOSE: 'panel:close',
  ACHIEVEMENT: 'achievement',
  ARCADE_OPEN: 'arcade:open',
  ARCADE_START: 'arcade:start',
  ARCADE_SHOOT: 'arcade:shoot',
  ARCADE_HIT: 'arcade:hit',
  ARCADE_HURT: 'arcade:hurt',
  ARCADE_MARCH: 'arcade:march',
  ARCADE_WAVE: 'arcade:wave',
  ARCADE_BONUS: 'arcade:bonus',
  ARCADE_OVER: 'arcade:over',
});

export type StepSurface = 'sidewalk' | 'road';

// Payload per event; `void` events are emitted bare. Targets are the picked/near door (see ui).
export interface GameEventPayloads {
  [GameEvent.START]: void;
  [GameEvent.STEP]: { surface: StepSurface; loudness: number };
  [GameEvent.JUMP]: void;
  [GameEvent.LAND]: void;
  [GameEvent.TELEPORT]: void;
  [GameEvent.SIT]: void;
  [GameEvent.STAND]: void;
  [GameEvent.CURB]: void;
  [GameEvent.CROSS]: void;
  [GameEvent.NEAR]: unknown;
  [GameEvent.OPEN]: unknown;
  [GameEvent.CLOSE]: void;
  [GameEvent.ACHIEVEMENT]: void;
  [GameEvent.ARCADE_OPEN]: void;
  [GameEvent.ARCADE_START]: void;
  [GameEvent.ARCADE_SHOOT]: void;
  [GameEvent.ARCADE_HIT]: void;
  [GameEvent.ARCADE_HURT]: void;
  [GameEvent.ARCADE_MARCH]: number; // beat 0..3 of the formation's four-note bass
  [GameEvent.ARCADE_WAVE]: void;
  [GameEvent.ARCADE_BONUS]: void;
  [GameEvent.ARCADE_OVER]: void;
}

export type GameEventType = keyof GameEventPayloads;
export type EventHandler<P> = (payload: P) => void;

export interface Emitter<E extends object = GameEventPayloads> {
  on<K extends keyof E>(type: K, handler: EventHandler<E[K]>): () => boolean;
  emit<K extends keyof E>(type: K, ...payload: E[K] extends void ? [] : [E[K]]): void;
}

export function createEmitter<E extends object = GameEventPayloads>(): Emitter<E> {
  const handlers = new Map<keyof E, Set<EventHandler<any>>>();
  return {
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => handlers.get(type)!.delete(handler);
    },
    emit(type, ...[payload]) {
      for (const handler of handlers.get(type) ?? []) handler(payload);
    },
  };
}
