import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_PARTS, cleanAvatar, fromSixParts } from '../server/avatar.mjs';
import { cleanEmblem, emblemRanges, isEmblem } from '../vendor/ewo/elements/emblem-core.js';

// The page draws faces with Folio's agent emblem (vendor/ewo); the server checks avatars on its own
// (the runtime image carries no vendor files). These keep the two in step after a vendor update.

test("the server's ranges are the agent emblem's", () => {
  assert.deepEqual([...AVATAR_PARTS], emblemRanges('agent'));
});

test('the server keeps what the emblem keeps, and replaces what it replaces', () => {
  const cases = [[0, 0, 0, 0, 0], [9, 7, 9, 7, 5], [10, 0, 0, 0, 0], [0, 8, 0, 0, 0], [0, 0, 0, 0, 6], [1, 2, 3, 4], [1.5, 0, 0, 0, 0], '1,2,3,4,0', null];
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
