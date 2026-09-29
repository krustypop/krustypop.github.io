export const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T =>
  root.querySelector(selector) as T;

export const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(selector),
];

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const fontsReady = (spec: string, timeoutMs: number) =>
  Promise.race([document.fonts.load(spec), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);

// Blurs after the click so Space / Enter go back to the game instead of re-pressing the button.
export function onPress(button: HTMLElement, handler: () => void) {
  button.addEventListener('click', () => {
    handler();
    button.blur();
  });
}
