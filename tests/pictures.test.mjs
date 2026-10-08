import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID, MOTIFS, drawPictures, isPicture, layout, pictureName, VIEW } from '../server/pictures/index.mjs';
import { seededInt } from './helpers.mjs';

// The motifs are drawn by the page as given, with fill none and the stroke set by CSS: only plain
// shapes and geometry, nothing that styles or scripts.
const ELEMENTS = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const ATTRIBUTES = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points']);

test('motifs: enough for a mixed board twice over, unique ids and names', () => {
  assert.ok(MOTIFS.length >= 120, `${MOTIFS.length}`);
  for (const key of ['id', 'de', 'en']) {
    const values = MOTIFS.map((m) => m[key].toLowerCase());
    assert.equal(new Set(values).size, values.length, `${key} repeats`);
  }
  for (const m of MOTIFS) assert.match(m.id, /^[a-z]+(-[a-z]+)*$/);
});

test('motifs are plain shapes only', () => {
  for (const m of MOTIFS) {
    for (const [, name, attrs] of m.svg.matchAll(/<(\w+)([^>]*)\/?>/g)) {
      assert.ok(ELEMENTS.has(name), `${m.id}: <${name}>`);
      for (const [, attr] of attrs.matchAll(/([\w:-]+)=/g)) assert.ok(ATTRIBUTES.has(attr), `${m.id}: ${attr}`);
    }
    assert.ok(!/script|style|on\w+=|href/i.test(m.svg), m.id);
  }
});

test('a hollow sits inside the grid', () => {
  for (const m of MOTIFS) {
    if (!m.hollow) continue;
    const [cx, cy, r] = m.hollow;
    assert.ok(r > 1 && cx - r >= 0 && cy - r >= 0 && cx + r <= 24 && cy + r <= 24, m.id);
  }
});

test('a deal: 20 cards, no motif twice, "in" only into a hollow, every part on the card', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const cards = drawPictures(20, seededInt(seed));
    assert.equal(cards.length, 20);
    const used = cards.flatMap((c) => [c.a, c.b]);
    assert.equal(new Set(used).size, 40);
    for (const c of cards) {
      assert.ok(isPicture(c));
      if (c.comp === 'in') assert.ok(BY_ID.get(c.a).hollow, `${c.a} has no hollow`);
      for (const part of layout(c)) {
        assert.ok(part.cx - part.size / 2 >= -2 && part.cx + part.size / 2 <= VIEW.w + 2, `${c.a}/${c.b}`);
        assert.ok(part.cy - part.size / 2 >= -2 && part.cy + part.size / 2 <= VIEW.h + 2, `${c.a}/${c.b}`);
      }
    }
    assert.ok(new Set(cards.map((c) => c.comp)).size >= 2);
  }
});

test('a card has a name in both languages', () => {
  const card = { a: 'bulb', b: 'fish', comp: 'in' };
  if (BY_ID.has('bulb') && BY_ID.has('fish')) {
    assert.equal(pictureName(card, 'de'), 'Fisch in Glühbirne');
    assert.equal(pictureName(card, 'en'), 'fish in light bulb');
  }
  assert.equal(pictureName({ a: MOTIFS[0].id, b: MOTIFS[1].id, comp: 'on' }, 'de'), `${MOTIFS[1].de} auf ${MOTIFS[0].de}`);
});
