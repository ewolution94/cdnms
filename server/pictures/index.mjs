// Picture cards: two motifs (motifs.mjs) put together, so a card points in more than one direction.
// The server deals the pairs and how they sit; every page draws them the same way from layout().
//
//   in    the second motif inside the first one's hollow (a fish in a light bulb)
//   on    the second riding on top of the first (a crown on a cloud)
//   pair  the two side by side, leaning in (a ladder and the moon)

import { MOTIFS } from './motifs.mjs';

export { MOTIFS };
export const COMPOSITIONS = Object.freeze(['in', 'on', 'pair']);
export const BY_ID = new Map(MOTIFS.map((m) => [m.id, m]));

/** The card's drawing area, in SVG units. */
export const VIEW = Object.freeze({ w: 48, h: 40 });

/**
 * n picture cards, no motif twice.
 * @param {number} n
 * @param {(n: number) => number} randomInt
 * @returns {{ a: string, b: string, comp: 'in' | 'on' | 'pair' }[]}
 */
export function drawPictures(n, randomInt) {
  if (MOTIFS.length < n * 2) throw new Error('no-pictures');
  const pool = [...MOTIFS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cards = [];
  for (let i = 0; i < n; i++) {
    let first = pool[2 * i];
    let second = pool[2 * i + 1];
    // A motif with a hollow takes the other one in, about half the time it can.
    if (!first.hollow && second.hollow) [first, second] = [second, first];
    const roll = randomInt(100);
    const comp = first.hollow && roll < 55 ? 'in' : roll % 2 ? 'on' : 'pair';
    cards.push({ a: first.id, b: second.id, comp });
  }
  return cards;
}

/** Is this a card drawPictures could have dealt? (The server checks what comes back from tests.) */
export function isPicture(card) {
  return Boolean(card && BY_ID.has(card.a) && BY_ID.has(card.b) && card.a !== card.b && COMPOSITIONS.includes(card.comp));
}

/**
 * Where the two motifs sit: centre, size (of the 24-unit grid's box) and rotation, in VIEW units.
 * @returns {{ id: string, cx: number, cy: number, size: number, rot: number }[]}
 */
export function layout({ a, b, comp }) {
  if (comp === 'in') {
    const host = BY_ID.get(a);
    const size = 38;
    const s = size / 24;
    const [hx, hy, hr] = host?.hollow ?? [12, 12, 4];
    return [
      { id: a, cx: 24, cy: 20, size, rot: 0 },
      // The inner motif's drawing fills about 21 of its 24 units: sized so it fits the hollow.
      { id: b, cx: 24 + (hx - 12) * s, cy: 20 + (hy - 12) * s, size: ((hr * 2 * s) / 21) * 24 * 0.92, rot: 0 },
    ];
  }
  if (comp === 'on') {
    return [
      { id: a, cx: 24, cy: 25.5, size: 28, rot: 0 },
      { id: b, cx: 24, cy: 8.5, size: 15, rot: 0 },
    ];
  }
  return [
    { id: a, cx: 15.5, cy: 21, size: 27, rot: -8 },
    { id: b, cx: 34, cy: 19.5, size: 22, rot: 10 },
  ];
}

/** The card's name, for screen readers and the end's log: "Fisch in Glühbirne". */
export function pictureName({ a, b, comp }, lang = 'de') {
  const first = BY_ID.get(a)?.[lang] ?? a;
  const second = BY_ID.get(b)?.[lang] ?? b;
  if (comp === 'in') return `${second} in ${first}`;
  if (comp === 'on') return lang === 'de' ? `${second} auf ${first}` : `${second} on ${first}`;
  return lang === 'de' ? `${first} und ${second}` : `${first} and ${second}`;
}
