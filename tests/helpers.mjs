// Shared by the game tests: a fake clock, a seeded random, and rooms set up the way pages use them.

import { createGames } from '../server/game.mjs';

/** A clock that only moves when the test says so. */
export function fakeClock(start = 1_000_000) {
  let t = start;
  let timers = [];
  return {
    now: () => t,
    setTimeout(fn, ms) {
      const handle = { at: t + ms, fn };
      timers.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      timers = timers.filter((h) => h !== handle);
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((h) => h.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((h) => h !== due);
        t = due.at;
        due.fn();
      }
      t = end;
    },
  };
}

/** A repeatable random integer below n. */
export function seededInt(seed = 1) {
  let s = seed >>> 0;
  return (n) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 2 ** 32) * n);
  };
}

export function setup(seed = 7) {
  const clock = fakeClock();
  const games = createGames({ clock, randomInt: seededInt(seed) });
  return { clock, games };
}

/** A page on the room's stream, keeping the latest view and the reactions it was sent. */
export function watch(games, code, playerId = null) {
  const page = { view: null, reacts: [] };
  page.close = games.subscribe(code, playerId, (event, data) => {
    const body = JSON.parse(data);
    if (event === 'view') page.view = body;
    else if (event === 'react') page.reacts.push(body);
  });
  return page;
}

const NAMES = ['Ben', 'Lea', 'Mia', 'Jonas', 'Emre', 'Sofia'];

/**
 * A host and `others` more players, all on the stream, seated as two teams: Anna (host) and Lea
 * give the clues; Ben and Mia guess for team 0, Jonas and Emre for team 1 (as many as there are).
 */
export function room(games, others = 3) {
  const host = games.create({ name: 'Anna', avatar: [1, 0, 0, 0, 0] });
  const seats = [host];
  for (let i = 0; i < others; i++) seats.push(games.join(host.code, { name: NAMES[i] }));
  const pages = seats.map((s) => watch(games, host.code, s.player));
  const act = (seat, action, body = {}) => games.act(host.code, seat.token, action, body);
  // Anna: team 0 spymaster (she is already). Ben: team 0 operative. Lea: team 1 spymaster. Mia: team 1 operative.
  if (seats[1]) act(seats[1], 'seat', { team: 0, role: 'op' });
  if (seats[2]) act(seats[2], 'seat', { team: 1, role: 'spy' });
  if (seats[3]) act(seats[3], 'seat', { team: 1, role: 'op' });
  if (seats[4]) act(seats[4], 'seat', { team: 0, role: 'op' });
  if (seats[5]) act(seats[5], 'seat', { team: 1, role: 'op' });
  return { code: host.code, seats, pages, host, act };
}

/** The key, from a spymaster's page. */
export const keyOf = (spyPage) => spyPage.view.game.key;

/** Card indices of one kind ('a', 'b', 0 or 1) that are still hidden. */
export function hidden(view, key, kind) {
  return key.flatMap((k, i) => (k === kind && !view.game.revealed[i] ? [i] : []));
}

/** A clue word that's surely not on any board. */
export const CLUE = 'Zyxquorp';
