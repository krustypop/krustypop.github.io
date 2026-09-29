const TYPE_MS = 28;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The bench's thought bubble: types the text out, or shows it at once under reduced motion.
export function createThought(root: HTMLElement) {
  const ghost = root.querySelector<HTMLElement>('.thought-ghost')!;
  const text = root.querySelector<HTMLElement>('.thought-text')!;
  let timer: ReturnType<typeof setInterval> | undefined;

  function hide() {
    clearInterval(timer);
    root.hidden = true;
  }

  function show(full: string) {
    hide();
    // Screen readers get the whole sentence once, not every letter.
    root.setAttribute('aria-label', full);
    ghost.textContent = full;
    root.hidden = false;
    if (reducedMotion()) {
      text.textContent = full;
      return;
    }
    const letters = [...full];
    let shown = 0;
    text.textContent = '';
    timer = setInterval(() => {
      text.textContent = letters.slice(0, ++shown).join('');
      if (shown >= letters.length) clearInterval(timer);
    }, TYPE_MS);
  }

  return { show, hide };
}
