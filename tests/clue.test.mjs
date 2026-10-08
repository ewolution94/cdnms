import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clueProblem, normalize } from '../server/clue.mjs';

const board = [{ word: 'Schloss' }, { word: 'Bank' }, { word: 'Strauß' }, { word: 'Ei' }];
const code = (word, strict = true) => clueProblem(word, board, { strict })?.code ?? null;

test('normalised: case, umlauts, ß and accents never decide', () => {
  assert.equal(normalize('Strauß'), 'strauss');
  assert.equal(normalize('Ärger'), 'aerger');
  assert.equal(normalize('Café'), 'cafe');
});

test('one word, letters and digits, a hyphen inside', () => {
  assert.equal(code(''), 'clue-empty');
  assert.equal(code('zwei Worte'), 'clue-space');
  assert.equal(code('E-Mail'), null);
  assert.equal(code('Rock’n’Roll'), null);
  assert.equal(code('?!'), 'clue-chars');
  assert.equal(code('x'.repeat(30)), 'clue-long');
});

test('not a word on the board, and strictly not part of one', () => {
  assert.equal(code('BANK'), 'clue-board');
  assert.equal(code('strauss'), 'clue-board');
  assert.equal(code('Schlossherr'), 'clue-part');
  assert.equal(code('Schlossherr', false), null);
  assert.equal(code('Ban'), 'clue-part');
  // Short words don't rule out half the board.
  assert.equal(code('Eis'), null);
  assert.deepEqual(clueProblem('Bankraub', board), { code: 'clue-part', word: 'Bank' });
});
