// An avatar is five small numbers: hat, eyes, disguise, collar, skin (the order of the maker's arrows,
// top to bottom). The page draws it with Folio's agent emblem (src/lib/avatar.ts); the server only
// checks the ranges (the runtime image carries no vendor files).

/** How many choices each part has: the agent emblem's (tests/avatar.test.mjs checks they match). */
export const AVATAR_PARTS = Object.freeze([10, 8, 10, 8, 6]);

/** Until 2026-10-08 an avatar had six numbers, the fifth its colour: the rest is still that agent. */
export const fromSixParts = (raw) => (Array.isArray(raw) && raw.length === 6 ? [...raw.slice(0, 4), raw[5]] : raw);

/** A valid avatar from whatever came in, or a random one. */
export function cleanAvatar(raw, random = Math.random) {
  const value = fromSixParts(raw);
  if (Array.isArray(value) && value.length === AVATAR_PARTS.length && value.every((v, i) => Number.isInteger(v) && v >= 0 && v < AVATAR_PARTS[i])) {
    return [...value];
  }
  return randomAvatar(random);
}

export function randomAvatar(random = Math.random) {
  return AVATAR_PARTS.map((n) => Math.floor(random() * n));
}
