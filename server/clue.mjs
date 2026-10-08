// A spymaster's clue against the board. The server checks every clue with this; the page runs the
// same code as the spymaster types, so the field says why a word won't do before it's sent.
//
// The rules (Codenames' own): one word; not a word that's still on the board; in strict mode not part
// of one either, nor containing one (Schloss / Schlossherr), until that card is covered. Compared
// normalised, so case, umlauts (ä = ae), ß = ss and accents never decide. A picture card has no word,
// so it never stands in the way. What the rules can't check (a translation, a homophone) is for the
// other team's Einspruch.

/** Lowercase letters and digits only, with ä→ae, ö→oe, ü→ue, ß→ss and accents dropped. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export const CLUE_MAX = 24;
/** "Part of" only counts from this many letters, so "Ei" doesn't rule out half the board. */
const PART_MIN = 3;

/** The clue as it's shown: trimmed, single-spaced, NFC. */
export function cleanClue(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CLUE_MAX * 2);
}

/**
 * Why a clue can't be given, or null when it can.
 * @param {string} raw  what the spymaster typed
 * @param {{ word: string }[]} words  the board's words still uncovered
 * @param {{ strict?: boolean }} [options]
 * @returns {null | { code: 'clue-empty' | 'clue-space' | 'clue-chars' | 'clue-long' | 'clue-board' | 'clue-part', word?: string }}
 */
export function clueProblem(raw, words, { strict = true } = {}) {
  const clue = cleanClue(raw);
  if (!clue) return { code: 'clue-empty' };
  if (/\s/.test(clue)) return { code: 'clue-space' };
  // Letters and digits, with a hyphen or an apostrophe inside a word (Rock'n'Roll, E-Mail).
  if (!/^[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*$/u.test(clue)) return { code: 'clue-chars' };
  if ([...clue].length > CLUE_MAX) return { code: 'clue-long' };
  const n = normalize(clue);
  if (!n) return { code: 'clue-chars' };
  for (const { word } of words) {
    const w = normalize(word);
    if (!w) continue;
    if (w === n) return { code: 'clue-board', word };
  }
  if (strict) {
    for (const { word } of words) {
      const w = normalize(word);
      if (w.length < PART_MIN || n.length < PART_MIN) continue;
      if (w.includes(n) || n.includes(w)) return { code: 'clue-part', word };
    }
  }
  return null;
}
