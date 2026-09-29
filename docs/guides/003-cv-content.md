# 003 — CV content

**Use when** changing CV text, adding a field to an experience, or showing content somewhere new.

## Rule

`src/data.ts` is the only place content lives. The world, the timeline, the sheets and the plain-text CV are all generated from it: one experience → one building, one sign, one billboard, one year marking, one timeline marker, one sheet. Code never hardcodes CV text.

## How

- New experience field:
  1. Add it to the experiences in `data.ts`.
  2. Render it in `ui/templates.ts` (sheet and `cvHTML`) and/or the world.
  3. Validate it in `tests/data.test.ts` if it is required or constrained.
- Every value that reaches HTML goes through `esc()` (`utils/dom.ts`). Templates build strings; the CV is text, never markup.
- Optional visual overrides are per experience and have defaults in code (`floors ?? 3 + (i % 3)`).
- `emblem` picks the prop shown on the roof and, smaller, on top of the blade sign that sticks out over the sidewalk, plus a themed ground floor (`world/storefronts.ts`) (`cap`, `clock`, `bag`, `house`, `octagon`, `coin`, `device`). To add one, extend the `Emblem` type in `data.ts` and add its builders in `world/emblems.ts` and `world/storefronts.ts` (the `Record` types force both); pick a prop that evokes the job, and keep it readable as a silhouette from the avenue. Storefront props keep the door and its pad clear, stay under the shop sign, and call `block()` when they stick out onto the sidewalk.
- `anecdote` (optional, ≤ 220 characters, enforced by the data test) is the thought typed out in a bubble (`ui/thought.ts`) while the player sits on the bench facing that building. Plain text, set with `textContent`, in Inter.
- Order matters: experiences are chronological, and the avenue is the timeline (the first job is nearest the spawn). The data test enforces it.

## Pitfalls

- Canvas signs shrink long names to fit, but very long company names get small: check the storefront and blade signs in the browser. The blade sign breaks the name on `/`.
- The pixel font lacks some glyphs (capital accented letters such as `É`, symbols such as `✉`); prefer plain text in pixel-font spots.
