import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_PARTS, cleanAvatar, fromFiveParts, fromSixParts } from '../server/avatar.mjs';
import { cleanEmblem, emblemRanges, isEmblem } from '../vendor/ewo/elements/emblem-core.js';

// The page draws faces with Folio's agent emblem (vendor/ewo); the server checks avatars on its own
// (the runtime image carries no vendor files). These keep the two in step after a vendor update.

test("the server's ranges are the agent emblem's", () => {
  assert.deepEqual([...AVATAR_PARTS], emblemRanges('agent'));
});

test('the server keeps what the emblem keeps, and replaces what it replaces', () => {
  const cases = [[0, 0, 0, 0, 0], [12, 7, 14, 10, 5], [13, 0, 0, 0, 0], [0, 8, 0, 0, 0], [0, 0, 15, 0, 0], [0, 0, 0, 11, 0], [0, 0, 0, 0, 6], [1, 2, 3, 4], [1.5, 0, 0, 0, 0], '1,2,3,4,0', null];
  for (const raw of cases) {
    const ours = cleanAvatar(raw);
    assert.ok(isEmblem('agent', ours), `${JSON.stringify(raw)} → ${ours}`);
    if (isEmblem('agent', raw)) assert.deepEqual(ours, cleanEmblem('agent', raw));
    else assert.notEqual(ours, raw);
  }
});

test('a six-number avatar from before the colour went keeps its agent, without the colour', () => {
  assert.deepEqual(cleanAvatar([1, 2, 3, 4, 9, 5]), [1, 2, 3, 4, 5]);
  assert.deepEqual(fromSixParts([1, 2, 3, 4, 9, 5]), [1, 2, 3, 4, 5]);
  assert.ok(isEmblem('agent', fromSixParts([9, 7, 9, 7, 9, 5])));
  // A six-number avatar with a bad part is still replaced.
  assert.ok(isEmblem('agent', cleanAvatar([1, 2, 3, 4, 0, 6])));
  assert.notDeepEqual(cleanAvatar([1, 2, 3, 4, 0, 6], () => 0), [1, 2, 3, 4, 6]);
});

test('an avatar from before 2026-10-13 is the same agent in today\'s parts, and still in range', () => {
  // [hat, eyes, disguise, collar, skin] → [hat, short hair, face, collar, skin]
  assert.deepEqual(fromFiveParts([1, 0, 0, 2, 3]), [1, 0, 0, 2, 3]);
  assert.deepEqual(fromFiveParts([1, 3, 6, 2, 3]), [1, 0, 6, 2, 3], 'a disguise keeps its number');
  assert.deepEqual(fromFiveParts([0, 2, 0, 0, 0]), [0, 0, 10, 0, 0], 'side-eye');
  assert.deepEqual(fromFiveParts([0, 3, 0, 0, 0]), [0, 0, 11, 0, 0], 'wink');
  assert.deepEqual(fromFiveParts([0, 4, 0, 0, 0]), [0, 0, 12, 0, 0], 'sceptical');
  assert.deepEqual(fromFiveParts([0, 6, 0, 0, 0]), [0, 0, 0, 0, 0], 'wide eyes are plain now');
  assert.deepEqual(fromFiveParts(fromSixParts([1, 2, 3, 4, 9, 5])), [1, 0, 3, 4, 5]);
  assert.equal(fromFiveParts(null), null);
  // Every old value is valid both as it was sent (an old tab) and migrated.
  for (let h = 0; h < 10; h++) for (let e = 0; e < 8; e++) for (let d = 0; d < 10; d++) {
    for (const v of [[h, e, d, 7, 5], fromFiveParts([h, e, d, 7, 5])]) assert.ok(isEmblem('agent', v), String(v));
  }
});
