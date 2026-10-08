// The words: the built-in lists (de.mjs, en.mjs; by pack), the host's own words, and a board's draw.
// A board never holds two words where one contains the other (Ball and Fußball): no clue could
// point at one without being part of the other.

import de from './de.mjs';
import en from './en.mjs';
import { normalize } from '../clue.mjs';

export const LISTS = Object.freeze({ de, en });
export const LANGS = Object.freeze(['de', 'en']);
export const PACKS = Object.freeze(['classic', 'everyday', 'nature', 'places', 'office', 'culture']);
/** How many of the host's own words go on a board: none, a few, about half, or only theirs. */
export const MIXES = Object.freeze(['none', 'few', 'half', 'only']);

export const CUSTOM_LIMITS = Object.freeze({ words: 400, length: 14, text: 6000, min: 25 });

export const counts = Object.fromEntries(LANGS.map((lang) => [lang, PACKS.reduce((n, pack) => n + (LISTS[lang][pack]?.length ?? 0), 0)]));

/**
 * The host's words, from whatever they pasted: commas, semicolons or lines between words; one word
 * each (letters, a hyphen inside), at most CUSTOM_LIMITS.length characters; no repeats.
 * @returns {string[]}
 */
export function parseCustom(text) {
  if (typeof text !== 'string') return [];
  const seen = new Set();
  const out = [];
  for (const part of text.slice(0, CUSTOM_LIMITS.text).split(/[,;\n\r]+/)) {
    const word = part.normalize('NFC').trim();
    if (!word || [...word].length > CUSTOM_LIMITS.length) continue;
    if (!/^\p{L}+(?:-\p{L}+)*$/u.test(word)) continue;
    const key = normalize(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= CUSTOM_LIMITS.words) break;
  }
  return out;
}

/** How many own words a board of n takes for a mix, given how many there are. */
export function customShare(mix, n, available) {
  if (mix === 'only') return n;
  if (mix === 'half') return Math.min(available, Math.round(n / 2));
  if (mix === 'few') return Math.min(available, Math.max(1, Math.round(n / 5)));
  return 0;
}

/**
 * n words for a board, shuffled.
 * @param {number} n
 * @param {{ lang: string, packs: string[], custom: string, mix: string }} settings
 * @param {(n: number) => number} randomInt
 * @returns {string[]}  throws 'no-words' or 'custom-few' as an Error message when it can't
 */
export function drawWords(n, { lang, packs, custom, mix }, randomInt) {
  const own = shuffle(parseCustom(custom), randomInt);
  const wanted = customShare(mix, n, own.length);
  if (mix === 'only' && own.length < n) throw new Error('custom-few');
  const list = LISTS[lang] ?? LISTS.de;
  const builtIn = shuffle(
    PACKS.filter((p) => packs.includes(p)).flatMap((p) => list[p] ?? []),
    randomInt,
  );
  if (wanted < n && !builtIn.length) throw new Error('no-words');

  const picked = [];
  const keys = [];
  const fits = (word) => {
    const k = normalize(word);
    return k && keys.every((other) => !other.includes(k) && !k.includes(other));
  };
  const take = (source, limit) => {
    for (const word of source) {
      if (picked.length >= limit) break;
      if (!fits(word)) continue;
      picked.push(word);
      keys.push(normalize(word));
    }
  };
  take(own, wanted);
  take(builtIn, n);
  // Rare: the host's words crowd the board. Fill up from theirs, then allow any built-in word.
  if (picked.length < n) take(own, n);
  if (picked.length < n) throw new Error(mix === 'only' ? 'custom-few' : 'no-words');
  return shuffle(picked, randomInt);
}

export function shuffle(list, randomInt) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
