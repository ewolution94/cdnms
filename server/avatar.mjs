// An avatar is five small numbers: hat, hair, face, collar, skin (the order of the maker's arrows,
// top to bottom). The page draws it with Folio's agent emblem (src/lib/avatar.ts); the server only
// checks the ranges (the runtime image carries no vendor files).

/** How many choices each part has: the agent emblem's (tests/avatar.test.mjs checks they match). */
export const AVATAR_PARTS = Object.freeze([13, 8, 15, 11, 6]);

/** Until 2026-10-08 an avatar had six numbers, the fifth its colour: the rest is still that agent. */
export const fromSixParts = (raw) => (Array.isArray(raw) && raw.length === 6 ? [...raw.slice(0, 4), raw[5]] : raw);

/**
 * Until 2026-10-13 the five numbers were hat, eyes, disguise, collar, skin. The same agent today: short
 * hair, and the disguise as the face (the first ten faces are the disguises as they were), or without
 * one, the eyes that are still a face of their own (side-eye, wink, sceptical). Only the page calls it,
 * on what it saved before: the numbers alone can't tell the two apart.
 */
export function fromFiveParts(raw) {
  if (!Array.isArray(raw) || raw.length !== 5) return raw;
  const [hat, eyes, disguise, collar, skin] = raw;
  const face = disguise > 0 ? disguise : ({ 2: 10, 3: 11, 4: 12 })[eyes] ?? 0;
  return [hat, 0, face, collar, skin];
}

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
