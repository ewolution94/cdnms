import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../server/clue.mjs';
import { LANGS, LISTS, PACKS, counts, customShare, drawWords, parseCustom } from '../server/words/index.mjs';
import { seededInt } from './helpers.mjs';

// The lists' own rules: one word of letters, short enough for a card, each once, and none inside
// another (a board can't hold both, so such pairs only shrink the variety).

test('every pack exists in both languages, about 400 words each', () => {
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(LISTS[lang]).sort(), [...PACKS].sort());
    assert.ok(counts[lang] >= 380, `${lang}: ${counts[lang]}`);
  }
});

test('words are one word of letters, fit a card, and are written the way the language writes them', () => {
  for (const lang of LANGS) {
    for (const [pack, words] of Object.entries(LISTS[lang])) {
      for (const w of words) {
        assert.match(w, /^\p{L}+$/u, `${lang}/${pack}: ${w}`);
        assert.ok([...w].length <= 11 && [...w.toUpperCase()].length <= 11, `${lang}/${pack}: ${w} is too long`);
        if (lang === 'de') assert.match(w, /^\p{Lu}/u, `${w} should be capitalised`);
        else assert.equal(w, w.toLowerCase(), `${w} should be lowercase`);
      }
    }
  }
});

test('no word twice, and none inside another', () => {
  for (const lang of LANGS) {
    const all = Object.values(LISTS[lang]).flat().map(normalize);
    assert.equal(new Set(all).size, all.length, `${lang} has repeats`);
    const inside = [];
    for (const a of all) for (const b of all) if (a !== b && b.includes(a)) inside.push(`${a} in ${b}`);
    assert.deepEqual(inside, [], `${lang}: ${inside.slice(0, 5).join(', ')}`);
  }
});

test('a board: 25 different words, the host’s share of their own, never one inside another', () => {
  const custom = 'Apfelkuchen, Kuchen, Zitrone, Melone, Ananas, Banane, Kiwi';
  for (const seed of [1, 2, 3, 4, 5]) {
    const words = drawWords(25, { lang: 'de', packs: [...PACKS], custom, mix: 'few' }, seededInt(seed));
    assert.equal(words.length, 25);
    const keys = words.map(normalize);
    assert.equal(new Set(keys).size, 25);
    for (const a of keys) for (const b of keys) assert.ok(a === b || !b.includes(a), `${a} in ${b}`);
    // Apfelkuchen and Kuchen never land together.
    assert.ok(!(keys.includes('apfelkuchen') && keys.includes('kuchen')));
  }
  assert.equal(customShare('few', 25, 40), 5);
  assert.equal(customShare('half', 25, 40), 13);
  assert.equal(customShare('half', 25, 4), 4);
  assert.throws(() => drawWords(25, { lang: 'de', packs: [], custom: '', mix: 'none' }, seededInt(1)), /no-words/);
});

test("the host's words: commas, semicolons and lines; one word each; no repeats", () => {
  assert.deepEqual(parseCustom('Apfel, Birne;Kirsche\nPflaume\n\n apfel , zwei Wörter, E-Mail, 42, Supercalifragilistisch'), ['Apfel', 'Birne', 'Kirsche', 'Pflaume', 'E-Mail']);
});
