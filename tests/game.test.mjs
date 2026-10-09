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

test('a new room: the host gives team 0 the clues, newcomers even out the teams', () => {
  const { games } = setup();
  const host = games.create({ name: 'Anna' });
  const ben = games.join(host.code, { name: 'Ben' });
  const lea = games.join(host.code, { name: 'Lea' });
  const v = games.view(host.code, host.player);
  const by = (id) => v.players.find((p) => p.id === id);
  assert.deepEqual([by(host.player).team, by(host.player).role], [0, 'spy']);
  assert.deepEqual([by(ben.player).team, by(ben.player).role], [1, 'op']);
  assert.deepEqual([by(lea.player).team, by(lea.player).role], [0, 'op']);
});

test('a spymaster seat is taken until its holder leaves it; the host can move anyone', () => {
  const { games } = setup();
  const r = room(games, 3);
  const [anna, ben] = r.seats;
  throws(() => r.act(ben, 'seat', { team: 0, role: 'spy' }), 'spy-taken');
  r.act(anna, 'seat', { team: 0, role: 'op' });
  r.act(ben, 'seat', { team: 0, role: 'spy' });
  r.act(anna, 'move', { player: anna.player, team: 0, role: 'spy' });
  const v = r.pages[0].view;
  assert.equal(v.players.find((p) => p.id === anna.player).role, 'spy');
  // Moving into a taken spymaster seat puts its holder among the operatives.
  assert.equal(v.players.find((p) => p.id === ben.player).role, 'op');
  throws(() => r.act(ben, 'move', { player: anna.player, team: 1, role: 'op' }), 'not-host');
});

test('the start needs a spymaster and an operative in each team', () => {
  const { games } = setup();
  const r = room(games, 2);
  throws(() => r.act(r.host, 'start'), 'need-op');
  const third = games.join(r.code, { name: 'Mia' });
  games.act(r.code, third.token, 'seat', { team: 1, role: 'op' });
  r.act(r.host, 'start');
  assert.equal(r.pages[0].view.phase, 'play');
});

test("the key: 9, 8, 7 and the assassin on words; 8, 7, 4 and one on pictures; the starter has the extra agent", () => {
  for (const cards of ['words', 'pictures', 'mixed']) {
    for (const seed of [1, 2, 3]) {
      const { pa } = started({ seed, settings: { cards } });
      const g = pa.view.game;
      const b = BOARDS[cards];
      assert.equal(g.cards.length, b.cols * b.rows);
      const count = (k) => g.key.filter((x) => x === k).length;
      assert.equal(count(g.starts), b.agents[0]);
      assert.equal(count(1 - g.starts), b.agents[1]);
      assert.equal(count('b'), b.bystanders);
      assert.equal(count('a'), 1);
      assert.equal(g.turn.team, g.starts);
      if (cards === 'mixed') assert.equal(g.cards.filter((c) => c.kind === 'pic').length, b.pictures);
      if (cards === 'pictures') assert.ok(g.cards.every((c) => c.kind === 'pic'));
    }
  }
});

test('the key reaches the spymasters only: not the operatives, the spectators or the big screen', () => {
  const { games, code, act, anna, pa, pb, pl, pm } = started();
  const screen = watch(games, code, null);
  const extra = games.join(code, { name: 'Zoe' });
  // Seats can't change mid-game by oneself; Zoe joined into a team, the host moves her to watch.
  act(anna, 'move', { player: extra.player, team: null });
  const zoe = watch(games, code, extra.player);
  assert.ok(pa.view.game.key && pl.view.game.key);
  for (const page of [pb, pm, screen, zoe]) {
    assert.equal(page.view.game.key, null);
    assert.ok(page.view.game.revealed.every((x) => x === null));
  }
  const raw = JSON.stringify(screen.view);
  assert.ok(!raw.includes('"key":[') && !raw.includes('"key":"a"'));
});

test('what a clue was meant for stays with its spymaster until the end', () => {
  const { act, pa, pb, pl, spyOf, opOf } = started();
  const g = pa.view.game;
  const team = g.turn.team;
  const spyPage = team === 0 ? pa : pl;
  const otherSpyPage = team === 0 ? pl : pa;
  const mine = hidden(spyPage.view, keyOf(spyPage), team).slice(0, 2);
  act(spyOf(team), 'clue', { word: CLUE, number: 2, cards: mine });
  assert.deepEqual(spyPage.view.game.turn.clue.intended, mine);
  assert.equal(otherSpyPage.view.game.turn.clue.intended, null);
  assert.equal(pb.view.game.turn.clue.intended, null);
  assert.equal(pb.view.game.turn.clue.word, CLUE);
  void opOf;
});

test('clue checks: one word, not on the board, not part of a board word (strict)', () => {
  const { act, pa, spyOf } = started({ settings: { cards: 'words' } });
  const g = pa.view.game;
  const spy = spyOf(g.turn.team);
  const word = g.cards.find((c) => c.kind === 'word').text;
  throws(() => act(spy, 'clue', { word: '', number: 1 }), 'clue-empty');
  throws(() => act(spy, 'clue', { word: 'zwei Worte', number: 1 }), 'clue-space');
  throws(() => act(spy, 'clue', { word: word.toUpperCase(), number: 1 }), 'clue-board');
  throws(() => act(spy, 'clue', { word: word + 'haus', number: 1 }), 'clue-part');
  throws(() => act(spy, 'clue', { word: CLUE, number: 10 }), 'clue-number');
  throws(() => act(spy, 'clue', { word: CLUE, number: 1, cards: [-1] }), 'clue-cards');
  const other = spyOf(1 - g.turn.team);
  throws(() => act(other, 'clue', { word: CLUE, number: 1 }), 'not-spy');
});

test('relaxed checks allow a word that contains a board word', () => {
  const { act, pa, spyOf } = started({ settings: { cards: 'words', checks: 'relaxed' } });
  const g = pa.view.game;
  const word = g.cards.find((c) => c.kind === 'word').text;
  act(spyOf(g.turn.team), 'clue', { word: word + 'haus', number: 1 });
  assert.equal(pa.view.game.turn.phase, 'guess');
});

test('guessing: own agents go on up to the number plus one, then the turn passes', () => {
  const { act, pa, spyOf, opOf } = started();
  const team = pa.view.game.turn.team;
  const spyPage = pa.view.game.key ? (team === 0 ? pa : null) : null;
  const key = keyOf(pa);
  act(spyOf(team), 'clue', { word: CLUE, number: 1 });
  const own = hidden(pa.view, key, team);
  act(opOf(team), 'reveal', { card: own[0] });
  assert.equal(pa.view.game.turn.team, team);
  assert.equal(pa.view.game.turn.guesses, 1);
  act(opOf(team), 'reveal', { card: own[1] });
  // 1 + 1 guesses: the other team's turn.
  assert.equal(pa.view.game.turn.team, 1 - team);
  assert.equal(pa.view.game.last.reason, 'limit');
  void spyPage;
});

test('a bystander or the other team\'s agent ends the turn; the latter counts for them', () => {
  const { act, pa, spyOf, opOf } = started();
  const key = keyOf(pa);
  let team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 3 });
  act(opOf(team), 'reveal', { card: hidden(pa.view, key, 'b')[0] });
  assert.equal(pa.view.game.last.reason, 'bystander');
  team = pa.view.game.turn.team;
  const theirsBefore = pa.view.game.left[1 - team];
  act(spyOf(team), 'clue', { word: CLUE, number: 3 });
  act(opOf(team), 'reveal', { card: hidden(pa.view, key, 1 - team)[0] });
  assert.equal(pa.view.game.last.reason, 'opponent');
  assert.equal(pa.view.game.left[1 - team], theirsBefore - 1);
});

test('the assassin loses the game at once', () => {
  const { act, pa, pb, spyOf, opOf } = started();
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 1 });
  act(opOf(team), 'reveal', { card: key.indexOf('a') });
  assert.equal(pa.view.phase, 'final');
  assert.equal(pa.view.game.winner, 1 - team);
  assert.equal(pa.view.game.ended, 'assassin');
  // At the end, everyone sees the whole key and what each clue was meant for.
  assert.deepEqual(pb.view.game.key, key);
  assert.deepEqual(pa.view.tally[1 - team], 1);
});

test('finding all your agents wins, ∞ lets a team keep going', () => {
  const { act, pa, spyOf, opOf } = started();
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 'inf' });
  for (const card of hidden(pa.view, key, team)) act(opOf(team), 'reveal', { card });
  assert.equal(pa.view.phase, 'final');
  assert.equal(pa.view.game.winner, team);
  assert.equal(pa.view.game.ended, 'agents');
  assert.equal(pa.view.game.stats.best.hits, pa.view.game.total[team]);
});

test('ending the guessing needs one guess first; only the guessing team may guess', () => {
  const { act, pa, spyOf, opOf } = started();
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  throws(() => act(opOf(team), 'reveal', { card: 0 }), 'wrong-phase');
  act(spyOf(team), 'clue', { word: CLUE, number: 2 });
  throws(() => act(opOf(team), 'end'), 'guess-first');
  throws(() => act(opOf(1 - team), 'reveal', { card: 0 }), 'not-yours');
  throws(() => act(spyOf(team), 'reveal', { card: 0 }), 'not-yours');
  act(opOf(team), 'reveal', { card: hidden(pa.view, key, team)[0] });
  act(opOf(team), 'end');
  assert.equal(pa.view.game.turn.team, 1 - team);
  assert.equal(pa.view.game.last.reason, 'stop');
});

test('a card turned twice at once is turned once', () => {
  const { games, code, act, pa, spyOf, opOf, seats } = started({ others: 5 });
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 3 });
  const card = hidden(pa.view, key, team)[0];
  act(opOf(team), 'reveal', { card });
  // Jonas (team 0) or Sofia (team 1) taps the same card a moment later.
  const second = team === 0 ? seats[4] : seats[5];
  games.act(code, second.token, 'reveal', { card });
  assert.equal(pa.view.game.turn.guesses, 1);
});

test('pointers: one per operative, visible to all, cleared with the turn; two must agree when set', () => {
  const { games, code, act, pa, pl, spyOf, opOf, seats } = started({ others: 5, settings: { agree: 2 } });
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 2 });
  const [c1, c2] = hidden(pa.view, key, team);
  act(opOf(team), 'mark', { card: c1 });
  act(opOf(team), 'mark', { card: c2 });
  assert.deepEqual(Object.keys(pl.view.game.marks), [String(c2)]);
  throws(() => act(opOf(team), 'reveal', { card: c2 }), 'agree');
  const second = team === 0 ? seats[4] : seats[5];
  games.act(code, second.token, 'mark', { card: c2 });
  act(opOf(team), 'reveal', { card: c2 });
  assert.ok(pa.view.game.revealed[c2]);
  act(opOf(team), 'end');
  assert.deepEqual(pa.view.game.marks, {});
});

test('the clock: the clue and the guessing each run out, and the turn passes', () => {
  const { clock, act, pa, spyOf } = started({ settings: { clock: 'quick' } });
  const team = pa.view.game.turn.team;
  // The first clue has 60 s plus 30 s.
  assert.equal(pa.view.game.turn.endsAt - clock.now(), 90_000);
  clock.advance(89_000);
  assert.equal(pa.view.game.turn.team, team);
  clock.advance(1_000);
  assert.equal(pa.view.game.turn.team, 1 - team);
  assert.equal(pa.view.game.last.reason, 'time');
  assert.equal(pa.view.game.turn.endsAt - clock.now(), 60_000);
  act(spyOf(1 - team), 'clue', { word: CLUE, number: 1 });
  assert.equal(pa.view.game.turn.endsAt - clock.now(), 90_000);
  clock.advance(90_000);
  assert.equal(pa.view.game.turn.team, team);
});

test('Einspruch: the other spymaster objects, the host rules; upheld costs the turn and helps the objectors', () => {
  const { act, pa, anna, spyOf, opOf } = started();
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 2 });
  throws(() => act(spyOf(team), 'object'), 'not-spy');
  act(spyOf(1 - team), 'object');
  throws(() => act(opOf(team), 'reveal', { card: hidden(pa.view, key, team)[0] }), 'objection');
  const theirs = pa.view.game.left[1 - team];
  act(anna, 'rule', { uphold: true });
  assert.equal(pa.view.game.left[1 - team], theirs - 1);
  assert.equal(pa.view.game.turn.team, 1 - team);
  assert.equal(pa.view.game.last.reason, 'objection');
  // Rejected: the guessing goes on.
  act(spyOf(1 - team), 'clue', { word: CLUE, number: 1 });
  act(spyOf(team), 'object');
  act(anna, 'rule', { uphold: false });
  assert.equal(pa.view.game.objection, null);
  act(opOf(1 - team), 'reveal', { card: hidden(pa.view, key, 1 - team)[0] });
  assert.equal(pa.view.game.turn.guesses, 1);
});

test('a spymaster keeps a poker face while their team guesses', () => {
  const { act, pa, spyOf, opOf } = started();
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 1 });
  throws(() => act(spyOf(team), 'react', { e: 0 }), 'poker-face');
  act(opOf(team), 'react', { e: 0 });
  act(spyOf(1 - team), 'react', { e: 1 });
  assert.equal(pa.reacts.length, 2);
});

test('a spymaster who leaves mid-game: the host is told, and seats someone else', () => {
  const { games, code, act, pa, anna, lea, mia } = started({ others: 5 });
  games.act(code, lea.token, 'leave');
  assert.equal(pa.view.notice, 'spy-gone');
  act(anna, 'move', { player: mia.player, team: 1, role: 'spy' });
  assert.equal(pa.view.notice, null);
});

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

test('play again: spymasters move on in each team, the tally stays', () => {
  const { act, pa, anna, ben, lea, mia, spyOf, opOf } = started();
  const key = keyOf(pa);
  const team = pa.view.game.turn.team;
  act(spyOf(team), 'clue', { word: CLUE, number: 1 });
  act(opOf(team), 'reveal', { card: key.indexOf('a') });
  assert.deepEqual(pa.view.game.nextSpies, [ben.player, mia.player]);
  act(anna, 'rematch');
  assert.equal(pa.view.phase, 'play');
  const role = (id) => pa.view.players.find((p) => p.id === id).role;
  assert.deepEqual([role(anna.player), role(ben.player), role(lea.player), role(mia.player)], ['op', 'spy', 'op', 'spy']);
  assert.equal(pa.view.tally[1 - team], 1);
  assert.equal(pa.view.game.n, 2);
});

test('back to the lobby from the end keeps the seats; the host shuffles into even teams', () => {
  const { games } = setup();
  const r = room(games, 5);
  r.act(r.host, 'shuffle');
  const v = r.pages[0].view;
  const size = (t) => v.players.filter((p) => p.team === t).length;
  assert.equal(size(0), 3);
  assert.equal(size(1), 3);
  for (const t of [0, 1]) assert.equal(v.players.filter((p) => p.team === t && p.role === 'spy').length, 1);
});

test("the host's own words: only the host sees them; 'only' needs a full board of them", () => {
  const { games } = setup();
  const r = room(games, 3);
  const words = Array.from({ length: 30 }, (_, i) => `Wort${'abcdefghijklmnopqrstuvwxyzäöüß'[i]}x`).join(', ');
  r.act(r.host, 'settings', { custom: 'Apfel, Birne, Kirsche', mix: 'only' });
  assert.equal(r.pages[1].view.settings.custom, '');
  assert.equal(r.pages[1].view.settings.customCount, 3);
  assert.throws(() => r.act(r.host, 'start'), (e) => e.code === 'custom-few');
  r.act(r.host, 'settings', { custom: words });
  r.act(r.host, 'start');
  assert.ok(r.pages[0].view.game.cards.every((c) => /^Wort/.test(c.text)));
});

test('a game nobody watches ends; an empty room is forgotten', () => {
  const { games, clock, pages, code } = started();
  for (const p of pages) p.close();
  games.tick();
  clock.advance(2 * 60_000 + 1);
  games.tick();
  assert.equal(games.view(code).phase, 'final');
  clock.advance(31 * 60_000);
  games.tick();
  assert.throws(() => games.view(code), (e) => e.code === 'no-room');
});

test('a retried New game or join carries its key and gets the same seat, for a minute', () => {
  const { games, clock } = setup();
  const host = games.create({ name: 'Anna', key: 'create-key-1' });
  assert.deepEqual(games.create({ name: 'Anna', key: 'create-key-1' }), host);
  assert.equal(games.size, 1);
  const ben = games.join(host.code, { name: 'Ben', key: 'join-key-01' });
  assert.deepEqual(games.join(host.code, { name: 'Ben', key: 'join-key-01' }), ben);
  assert.equal(games.view(host.code, host.player).players.length, 2);
  // Another key, or no key, is another tap: another seat.
  assert.notEqual(games.join(host.code, { name: 'Ben', key: 'join-key-02' }).player, ben.player);
  assert.notEqual(games.join(host.code, { name: 'Ben' }).player, ben.player);
  // A join key never answers for another room, and after a minute it's forgotten.
  const other = games.create({ name: 'Lea' });
  assert.notEqual(games.join(other.code, { name: 'Ben', key: 'join-key-01' }).player, ben.player);
  clock.advance(61_000);
  assert.notEqual(games.join(host.code, { name: 'Ben', key: 'join-key-01' }).player, ben.player);
});

test('the host ends a running game for everyone: the end, marked as ended early by them', () => {
  const { games, code, act, pa, pb, anna, ben } = started();
  throws(() => act(ben, 'stop'), 'not-host');
  act(anna, 'stop');
  for (const page of [pa, pb]) {
    assert.equal(page.view.phase, 'final');
    assert.equal(page.view.game.ended, 'stopped');
    assert.equal(page.view.game.stoppedBy, anna.player);
    assert.equal(page.view.game.winner, null);
  }
  // Nothing to end at the end; Play again starts clean.
  throws(() => act(anna, 'stop'), 'wrong-phase');
  act(anna, 'rematch');
  assert.equal(pa.view.phase, 'play');
  assert.equal(pa.view.game.stoppedBy, null);
  assert.equal(games.view(code, anna.player).game.ended, null);
});

test('nothing to end in the lobby', () => {
  const { games } = setup();
  const r = room(games, 3);
  throws(() => r.act(r.host, 'stop'), 'wrong-phase');
});

test('anyone can leave a running game: the others play on, and the host hands over', () => {
  const { games, code, pa, pl, anna, ben } = started({ others: 5 });
  games.act(code, ben.token, 'leave');
  assert.equal(pa.view.phase, 'play');
  assert.equal(pa.view.players.find((p) => p.id === ben.player), undefined);
  games.act(code, anna.token, 'leave');
  assert.equal(pl.view.phase, 'play');
  assert.ok(pl.view.host && pl.view.host !== anna.player);
});
