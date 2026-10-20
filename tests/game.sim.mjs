// Simulated games: bots play a whole game through the rooms. Not in CI (the user, 2026-10-20: "rely on
// simpler (unit) tests there"); run them with `npm run test:sim`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, GameError } from '../server/game.mjs';
import { CLUE, hidden, keyOf, room, setup, watch } from './helpers.mjs';

const throws = (fn, code) => assert.throws(fn, (e) => e instanceof GameError && e.code === code, code);

/** A started game: Anna and Lea spymasters, Ben (team 0) and Mia (team 1) guessing. */
function started({ seed = 7, settings = {}, others = 3 } = {}) {
  const { clock, games } = setup(seed);
  const r = room(games, others);
  if (Object.keys(settings).length) r.act(r.host, 'settings', settings);
  r.act(r.host, 'start');
  const [anna, ben, lea, mia] = r.seats;
  const [pa, pb, pl, pm] = r.pages;
  const spyOf = (team) => (team === 0 ? anna : lea);
  const opOf = (team) => (team === 0 ? ben : mia);
  return { clock, games, ...r, anna, ben, lea, mia, pa, pb, pl, pm, spyOf, opOf };
}

test('bots play a whole game to its end', () => {
  const { games, clock } = setup(11);
  const host = games.create({ name: 'Anna' });
  const page = watch(games, host.code, host.player);
  const act = (action, body = {}) => games.act(host.code, host.token, action, body);
  act('seat', { team: null });
  act('bot', { add: true, team: 0, role: 'spy' });
  act('bot', { add: true, team: 0, role: 'op' });
  act('bot', { add: true, team: 1, role: 'spy' });
  act('bot', { add: true, team: 1, role: 'op' });
  act('settings', { cards: 'mixed' });
  act('start');
  for (let i = 0; i < 400 && page.view.phase === 'play'; i++) clock.advance(1000);
  assert.equal(page.view.phase, 'final');
  assert.ok(page.view.game.clues.length >= 1);
  assert.ok(page.view.game.winner === 0 || page.view.game.winner === 1);
});
