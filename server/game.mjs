// The game: rooms, seats, turns and the clock. No I/O: the HTTP layer (server/api.mjs) calls these
// functions and streams each player their own view; tests drive it with a fake clock.
//
// A room lives in memory only. A restart (a deploy) ends every game, and an empty room is forgotten
// after half an hour.
//
// Codenames' Classic game: two teams (0 and 1), each with one spymaster ("Chef", role 'spy') and
// operatives ("Ermittler", role 'op'); anyone else watches (team null). A board of word cards (5×5),
// picture cards (5×4, as in Codenames Pictures) or both (5×5) has a key only the spymasters see:
// each card is team 0's agent, team 1's, a bystander ('b') or the assassin ('a'). A turn is the
// spymaster's clue (one word and a number), then the operatives' guesses, up to the number plus one.
// Their own agent: go on. A bystander or the other team's agent: the turn ends. The assassin: they
// lose. The first team to find all its agents wins.
//
// Phases: lobby → play (turn.phase: clue → guess → the other team's clue → …) → final.
//
// The key never leaks: every stream is built for its page (view below). Operatives, spectators and the
// big screen see only what's been revealed; the spymasters see the key; the cards a spymaster meant
// with a clue stay with that spymaster until the game is over.

import { randomBytes, randomInt as cryptoInt } from 'node:crypto';
import { cleanAvatar, randomAvatar } from './avatar.mjs';
import { cleanClue, clueProblem } from './clue.mjs';
import { drawPictures } from './pictures/index.mjs';
import { LANGS, MIXES, PACKS, drawWords, parseCustom, shuffle } from './words/index.mjs';

export class GameError extends Error {
  /** @param {string} code  @param {number} [status]  @param {Record<string, unknown>} [detail] */
  constructor(code, status = 400, detail = undefined) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** Room codes have no vowels, so no code spells a word. */
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;

export const CARD_KINDS = Object.freeze(['words', 'pictures', 'mixed']);
export const CLOCKS = Object.freeze(['off', 'quick', 'custom']);
export const CLUE_SECONDS = Object.freeze([30, 60, 90, 120, 180]);
export const GUESS_SECONDS = Object.freeze([30, 60, 90, 120, 180, 240]);
export const BONUS_SECONDS = Object.freeze([0, 30, 60]);
/** strict: a clue may not be part of a word on the board, nor contain one · relaxed: only not equal */
export const CHECKS = Object.freeze(['strict', 'relaxed']);
/** Operatives who must point at a card before it can be turned over (capped by the team's size). */
export const AGREE = Object.freeze([1, 2]);
/** A clue's number: 0 to 9, or 'inf' (∞, as many as you like). */
export const NUMBERS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'inf']);
export const REACTIONS = Object.freeze(['👍', '😂', '😮', '🤔', '🔥', '🙈']);

/** Board sizes and the key's make-up: the starting team gets the extra agent. */
export const BOARDS = Object.freeze({
  words: { cols: 5, rows: 5, agents: [9, 8], bystanders: 7 },
  pictures: { cols: 5, rows: 4, agents: [8, 7], bystanders: 4 },
  mixed: { cols: 5, rows: 5, agents: [9, 8], bystanders: 7, pictures: 12 },
});

const QUICK = Object.freeze({ clueSeconds: 60, guessSeconds: 90, firstBonus: 30 });

export const DEFAULT_SETTINGS = Object.freeze({
  cards: 'words',
  lang: 'de',
  packs: Object.freeze([...PACKS]),
  custom: '',
  mix: 'none',
  clock: 'off',
  clueSeconds: 90,
  guessSeconds: 120,
  firstBonus: 30,
  checks: 'strict',
  objections: true,
  agree: 1,
});

export const LIMITS = {
  rooms: 200,
  players: 20,
  bots: 8,
  name: 16,
  roomsPer10Min: 40,
};

const HOST_GRACE = 15_000;
const LOBBY_GRACE = 60_000;
const EMPTY_TTL = 30 * 60_000;
/** A game with no human online for this long ends, so bots never play on for no one. */
const UNWATCHED_MS = 2 * 60_000;
const IDLE_TTL = 4 * 60 * 60_000;
const REACT_GAP = 250;
/** Bots think for a moment: between these many milliseconds. */
const BOT_THINK = [2200, 4200];

const BOT_NAMES = ['Robo Rita', 'Bot Bernd', 'Agent Null', 'Kurier Kim', 'Mister X', 'Funker Fritz', 'Spitzel Sam', 'Akte Anni'];
/** What a bot spymaster says. Not clever (bots are for trying the game out), but always legal. */
const BOT_CLUES = {
  de: ['Abenteuer', 'Alltag', 'Farbe', 'Form', 'Geheimnis', 'Glück', 'Kindheit', 'Natur', 'Reise', 'Sommer', 'Wasser', 'Winter', 'Zeit', 'Zuhause', 'Musik', 'Licht'],
  en: ['adventure', 'colour', 'shape', 'secret', 'luck', 'childhood', 'nature', 'journey', 'summer', 'water', 'winter', 'time', 'home', 'music', 'light', 'magic'],
};

/**
 * @typedef {{ now(): number, setTimeout(fn: () => void, ms: number): any, clearTimeout(handle: any): void }} Clock
 * @typedef {{ player: string | null, send(event: string, data: string): void }} Subscriber
 */

const realClock = { now: Date.now, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) };

/**
 * @param {{ clock?: Clock, randomInt?: (n: number) => number }} [options]
 *   randomInt deals the boards, the key and the bots' moves (tests pass a seeded one)
 */
export function createGames({ clock = realClock, randomInt = (n) => cryptoInt(n) } = {}) {
  /** @type {Map<string, any>} */
  const rooms = new Map();
  const created = [];
  const random = () => randomInt(1_000_000) / 1_000_000;

  // ---- helpers ------------------------------------------------------------------------------

  function room(code) {
    const r = rooms.get(String(code ?? '').toUpperCase());
    if (!r) throw new GameError('no-room', 404);
    return r;
  }

  // ---- a page's retry is the same request ---------------------------------------------------
  // "New game" and a join carry a key the page keeps for every try of the same tap: a retry after
  // the page gave up (Folio's track(), 12 s) returns the seat the first try made, instead of a second
  // room or a second seat (development/plans/waiting-states.md). Kept for a minute.

  /** @type {Map<string, { seat: { code: string, player: string, token: string }, at: number }>} */
  const keyed = new Map();
  const KEY = /^[A-Za-z0-9-]{8,64}$/;
  const KEY_TTL = 60_000;

  function keyedSeat(key, code = null) {
    if (typeof key !== 'string' || !KEY.test(key)) return null;
    const t = clock.now();
    for (const [k, v] of keyed) if (t - v.at > KEY_TTL) keyed.delete(k);
    const hit = keyed.get(key);
    if (!hit || (code && hit.seat.code !== code)) return null;
    const p = rooms.get(hit.seat.code)?.players.get(hit.seat.player);
    return p && !p.left ? { ...hit.seat } : null;
  }

  function remember(key, seat) {
    if (typeof key === 'string' && KEY.test(key)) keyed.set(key, { seat, at: clock.now() });
    return seat;
  }

  function within(stamps, windowMs, limit) {
    const t = clock.now();
    while (stamps.length && stamps[0] <= t - windowMs) stamps.shift();
    if (stamps.length >= limit) return false;
    stamps.push(t);
    return true;
  }

  function newCode() {
    for (let i = 0; i < 100; i++) {
      let code = '';
      for (let j = 0; j < 4; j++) code += CODE_LETTERS[cryptoInt(CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
    throw new GameError('busy', 503);
  }

  function player(r, token) {
    if (typeof token !== 'string' || !token) throw new GameError('no-player', 401);
    for (const p of r.players.values()) if (p.token === token && !p.left && !p.bot) return p;
    throw new GameError('no-player', 401);
  }

  function requireHost(r, p) {
    if (r.host !== p.id) throw new GameError('not-host', 403);
  }

  function requirePhase(r, ...phases) {
    if (!phases.includes(r.phase)) throw new GameError('wrong-phase', 409);
  }

  /** Players who are still in the room, in the order they joined. */
  function present(r) {
    return [...r.players.values()].filter((p) => !p.left);
  }

  const isOnline = (p) => p.bot || p.online > 0;
  const teamOf = (r, team) => present(r).filter((p) => p.team === team);
  const spymaster = (r, team) => present(r).find((p) => p.team === team && p.role === 'spy') ?? null;
  const operatives = (r, team) => present(r).filter((p) => p.team === team && p.role === 'op');

  /** The team with fewer players (team 0 on a tie). */
  function smallerTeam(r) {
    return teamOf(r, 1).length < teamOf(r, 0).length ? 1 : 0;
  }

  function addPlayer(r, rawName, rawAvatar, bot = false) {
    if (present(r).length >= LIMITS.players) throw new GameError('room-full', 409);
    const base = cleanName(rawName);
    if (!base) throw new GameError('name');
    const taken = new Set(present(r).map((p) => p.name.toLowerCase()));
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    const p = {
      id: randomBytes(6).toString('base64url'),
      token: bot ? '' : randomBytes(18).toString('base64url'),
      name,
      avatar: cleanAvatar(rawAvatar, random),
      bot,
      team: smallerTeam(r),
      role: 'op',
      joined: clock.now(),
      online: 0,
      offlineSince: clock.now(),
      left: false,
      reacted: 0,
    };
    r.players.set(p.id, p);
    return p;
  }

  function touch(r) {
    r.touched = clock.now();
    r.version++;
    broadcast(r);
  }

  function later(r, ms, fn) {
    const handle = clock.setTimeout(() => {
      r.timers.delete(handle);
      if (rooms.get(r.code) === r) fn();
    }, ms);
    r.timers.add(handle);
    return handle;
  }

  function clearTimers(r) {
    for (const handle of r.timers) clock.clearTimeout(handle);
    r.timers.clear();
  }

  // ---- the board ----------------------------------------------------------------------------

  function newGame(r) {
    const s = r.settings;
    const board = BOARDS[s.cards];
    const n = board.cols * board.rows;
    const draw = (count) => {
      try {
        return drawWords(count, s, randomInt).map((text) => ({ kind: 'word', text }));
      } catch (error) {
        throw new GameError(error instanceof Error ? error.message : 'no-words', 409);
      }
    };
    let cards;
    if (s.cards === 'words') cards = draw(n);
    else if (s.cards === 'pictures') cards = drawPictures(n, randomInt).map((c) => ({ kind: 'pic', ...c }));
    else cards = shuffle([...draw(n - board.pictures), ...drawPictures(board.pictures, randomInt).map((c) => ({ kind: 'pic', ...c }))], randomInt);

    const starts = randomInt(2);
    const key = shuffle(
      [...Array(board.agents[0]).fill(starts), ...Array(board.agents[1]).fill(1 - starts), ...Array(board.bystanders).fill('b'), 'a'],
      randomInt,
    );
    r.games++;
    r.game = {
      n: r.games,
      kind: s.cards,
      cols: board.cols,
      rows: board.rows,
      cards,
      key,
      /** Per card: null, or who turned it over and when. */
      revealed: Array(n).fill(null),
      starts,
      turn: null,
      turns: 0,
      clues: [],
      /** The guessing team's pointers: card → player ids. */
      marks: new Map(),
      objection: null,
      /** How the last turn ended, for the page to say so. */
      last: null,
      /** The most operatives that ever pointed at the assassin at once. */
      assassinMarks: 0,
      winner: null,
      ended: null,
      /** Who ended the game early ('stop'), for the end screen. */
      stoppedBy: null,
      startedAt: clock.now(),
      endedAt: null,
    };
  }

  /** Agents still hidden, per team. */
  function agentsLeft(g) {
    const left = [0, 0];
    g.key.forEach((k, i) => {
      if ((k === 0 || k === 1) && !g.revealed[i]) left[k]++;
    });
    return left;
  }

  const total = (g) => [g.key.filter((k) => k === 0).length, g.key.filter((k) => k === 1).length];

  /** The words a clue may not be (or, strictly, be part of): the uncovered word cards. */
  const openWords = (g) => g.cards.flatMap((c, i) => (c.kind === 'word' && !g.revealed[i] ? [{ word: c.text }] : []));

  const maxGuesses = (clue) => (clue.number === 0 || clue.number === 'inf' ? Infinity : clue.number + 1);

  // ---- turns --------------------------------------------------------------------------------

  function startGame(r) {
    for (const team of [0, 1]) {
      if (!spymaster(r, team)) throw new GameError('need-spy', 409, { team });
      if (!operatives(r, team).length) throw new GameError('need-op', 409, { team });
    }
    clearTimers(r);
    newGame(r);
    r.phase = 'play';
    r.notice = null;
    r.unwatchedSince = null;
    startTurn(r, r.game.starts);
  }

  function seconds(r, phase) {
    const s = r.settings;
    if (s.clock === 'off') return 0;
    const set = s.clock === 'quick' ? QUICK : s;
    if (phase === 'guess') return set.guessSeconds;
    return set.clueSeconds + (r.game.turns === 1 ? set.firstBonus : 0);
  }

  /** Starts the phase's clock, if the room plays with one. */
  function runClock(r) {
    const g = r.game;
    const t = g.turn;
    const s = seconds(r, t.phase);
    t.endsAt = s ? clock.now() + s * 1000 : null;
    if (!s) return;
    const { n, phase } = t;
    later(r, s * 1000, () => {
      if (r.phase === 'play' && g.turn?.n === n && g.turn.phase === phase && !g.objection) endTurn(r, 'time');
    });
  }

  function startTurn(r, team) {
    const g = r.game;
    g.turns++;
    g.turn = { n: g.turns, team, phase: 'clue', clue: null, guesses: 0, endsAt: null, startedAt: clock.now() };
    g.marks = new Map();
    g.objection = null;
    runClock(r);
    touch(r);
    botsPlay(r);
  }

  function endTurn(r, reason) {
    const g = r.game;
    const t = g.turn;
    g.last = { turn: t.n, team: t.team, reason };
    if (t.clue) t.clue.ended = reason;
    startTurn(r, 1 - t.team);
  }

  function finish(r, winner, reason) {
    const g = r.game;
    clearTimers(r);
    if (g) {
      g.winner = winner;
      g.ended = reason;
      g.endedAt = clock.now();
      if (g.turn?.clue && !g.turn.clue.ended) g.turn.clue.ended = reason;
      g.objection = null;
      g.marks = new Map();
    }
    if (winner === 0 || winner === 1) r.tally[winner]++;
    r.phase = 'final';
    touch(r);
  }

  function giveClue(r, p, body) {
    const g = r.game;
    const t = g.turn;
    if (t.phase !== 'clue') throw new GameError('wrong-phase', 409);
    if (p.role !== 'spy' || p.team !== t.team) throw new GameError('not-spy', 403);
    const word = cleanClue(body?.word);
    const problem = clueProblem(word, openWords(g), { strict: r.settings.checks === 'strict' });
    if (problem) throw new GameError(problem.code, 400, problem.word ? { word: problem.word } : undefined);
    const number = body?.number;
    if (!NUMBERS.includes(number)) throw new GameError('clue-number');
    const intended = Array.isArray(body?.cards) ? [...new Set(body.cards)] : [];
    for (const i of intended) {
      if (!Number.isInteger(i) || i < 0 || i >= g.cards.length || g.revealed[i] || g.key[i] !== t.team) throw new GameError('clue-cards');
    }
    const clue = { turn: t.n, team: t.team, word, number, by: p.id, intended, picks: [], at: clock.now(), ended: null, objected: null };
    g.clues.push(clue);
    t.clue = clue;
    t.phase = 'guess';
    runClock(r);
    touch(r);
    botsPlay(r);
  }

  function mark(r, p, card) {
    const g = r.game;
    const t = g.turn;
    if (t.phase !== 'guess') throw new GameError('wrong-phase', 409);
    if (p.role !== 'op' || p.team !== t.team) throw new GameError('not-yours', 403);
    if (!Number.isInteger(card) || card < 0 || card >= g.cards.length || g.revealed[card]) throw new GameError('card');
    const set = g.marks.get(card) ?? new Set();
    if (set.has(p.id)) set.delete(p.id);
    else {
      // One pointer per player: pointing somewhere else moves it.
      for (const [other, s] of g.marks) {
        s.delete(p.id);
        if (!s.size) g.marks.delete(other);
      }
      set.add(p.id);
    }
    if (set.size) g.marks.set(card, set);
    else g.marks.delete(card);
    if (g.key[card] === 'a') g.assassinMarks = Math.max(g.assassinMarks, set.size);
    touch(r);
  }

  function reveal(r, p, card) {
    const g = r.game;
    const t = g.turn;
    if (t.phase !== 'guess') throw new GameError('wrong-phase', 409);
    if (p.role !== 'op' || p.team !== t.team) throw new GameError('not-yours', 403);
    if (g.objection) throw new GameError('objection', 409);
    if (!Number.isInteger(card) || card < 0 || card >= g.cards.length) throw new GameError('card');
    // Two taps from two people at once: the first turns it, the second is a no-op.
    if (g.revealed[card]) return;
    const need = Math.min(r.settings.agree, operatives(r, t.team).filter(isOnline).length || 1);
    if (need > 1 && (g.marks.get(card)?.size ?? 0) < need) throw new GameError('agree', 409);
    turnOver(r, card, p.id);
  }

  /** A card is turned over: what it means for the turn and the game. */
  function turnOver(r, card, by) {
    const g = r.game;
    const t = g.turn;
    const k = g.key[card];
    g.revealed[card] = { by, turn: t.n, at: clock.now() };
    t.clue.picks.push({ card, key: k, by });
    t.guesses++;
    g.marks.delete(card);
    if (k === 'a') return finish(r, 1 - t.team, 'assassin');
    const left = agentsLeft(g);
    if (k === 0 || k === 1) {
      if (!left[k]) return finish(r, k, 'agents');
    }
    if (k !== t.team) return endTurn(r, k === 'b' ? 'bystander' : 'opponent');
    if (t.guesses >= maxGuesses(t.clue)) return endTurn(r, 'limit');
    touch(r);
    botsPlay(r);
  }

  /** Einspruch upheld: the objecting team covers one of its own agents, and the turn ends. */
  function upholdObjection(r) {
    const g = r.game;
    const o = g.objection;
    const t = g.turn;
    g.objection = null;
    if (t.clue) t.clue.objected = 'upheld';
    const theirs = g.key.flatMap((k, i) => (k === o.team && !g.revealed[i] ? [i] : []));
    if (theirs.length) {
      const card = theirs[randomInt(theirs.length)];
      g.revealed[card] = { by: null, turn: t.n, at: clock.now(), penalty: true };
      if (!agentsLeft(g)[o.team]) return finish(r, o.team, 'agents');
    }
    endTurn(r, 'objection');
  }

  // ---- bots ---------------------------------------------------------------------------------

  const think = () => BOT_THINK[0] + randomInt(BOT_THINK[1] - BOT_THINK[0]);

  /** Lets a bot act if it's a bot's move: a bot spymaster's clue, or bot operatives on a team without people online. */
  function botsPlay(r) {
    const g = r.game;
    const t = g?.turn;
    if (r.phase !== 'play' || !t) return;
    const { n, phase, guesses } = t;
    const still = () => r.phase === 'play' && g.turn === t && t.n === n && t.phase === phase && t.guesses === guesses && !g.objection;
    if (phase === 'clue') {
      const spy = spymaster(r, t.team);
      if (spy?.bot) later(r, think(), () => still() && botClue(r, spy));
      return;
    }
    const ops = operatives(r, t.team);
    if (ops.some((q) => !q.bot && q.online > 0)) return;
    const bot = ops.find((q) => q.bot);
    if (bot) later(r, think(), () => still() && botGuess(r, bot));
  }

  function botClue(r, spy) {
    const g = r.game;
    const t = g.turn;
    const own = shuffle(
      g.key.flatMap((k, i) => (k === t.team && !g.revealed[i] ? [i] : [])),
      randomInt,
    );
    const cards = own.slice(0, Math.min(own.length, 1 + randomInt(2)));
    const words = openWords(g);
    const word = shuffle(BOT_CLUES[r.settings.lang] ?? BOT_CLUES.de, randomInt).find((w) => !clueProblem(w, words, { strict: true })) ?? 'Hinweis';
    giveClue(r, spy, { word, number: cards.length, cards });
  }

  function botGuess(r, bot) {
    const g = r.game;
    const t = g.turn;
    const hidden = g.cards.flatMap((_, i) => (g.revealed[i] ? [] : [i]));
    const meant = t.clue.intended.filter((i) => !g.revealed[i]);
    if (!meant.length && t.guesses > 0) return endTurn(r, 'stop');
    let card;
    if (meant.length && randomInt(100) < 75) card = meant[randomInt(meant.length)];
    else {
      const safe = hidden.filter((i) => g.key[i] !== 'a');
      const from = safe.length && randomInt(100) < 90 ? safe : hidden;
      card = from[randomInt(from.length)];
    }
    turnOver(r, card, bot.id);
  }

  // ---- what each page gets ------------------------------------------------------------------

  /** @param {any} r  @param {any | null} viewer  the player whose page this is; null for the big screen */
  function view(r, viewer) {
    const me = viewer && !viewer.left ? viewer : null;
    const host = me?.id === r.host;
    return {
      code: r.code,
      phase: r.phase,
      version: r.version,
      host: r.host,
      me: me?.id ?? null,
      // The host's own words would give the board away: the others only see how many there are.
      settings: { ...r.settings, packs: [...r.settings.packs], custom: host ? r.settings.custom : '', customCount: r.customCount },
      notice: r.notice,
      players: present(r).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        team: p.team,
        role: p.role,
        online: isOnline(p),
        bot: p.bot,
      })),
      tally: r.tally,
      game: r.game ? gameView(r, r.game, me) : null,
      reactions: REACTIONS,
      now: clock.now(),
    };
  }

  function gameView(r, g, me) {
    const final = r.phase === 'final';
    const spy = Boolean(me && me.role === 'spy' && me.team !== null);
    const t = g.turn;
    const clueView = (c) => ({
      turn: c.turn,
      team: c.team,
      word: c.word,
      number: c.number,
      by: c.by,
      at: c.at,
      picks: c.picks,
      // What a clue was meant for: the team's own spymaster now, everyone at the end.
      intended: final || (spy && me.team === c.team) ? c.intended : null,
      ended: c.ended,
      objected: c.objected,
    });
    return {
      n: g.n,
      kind: g.kind,
      cols: g.cols,
      rows: g.rows,
      cards: g.cards,
      revealed: g.revealed.map((x, i) => (x ? { key: g.key[i], by: x.by, turn: x.turn, penalty: Boolean(x.penalty) } : null)),
      key: final || spy ? g.key : null,
      starts: g.starts,
      left: agentsLeft(g),
      total: total(g),
      turn: t
        ? {
            n: t.n,
            team: t.team,
            phase: t.phase,
            clue: t.clue ? clueView(t.clue) : null,
            guesses: t.guesses,
            max: t.clue && maxGuesses(t.clue) !== Infinity ? maxGuesses(t.clue) : null,
            endsAt: final ? null : t.endsAt,
            startedAt: t.startedAt,
          }
        : null,
      marks: Object.fromEntries([...g.marks].map(([card, set]) => [card, [...set]])),
      clues: g.clues.map(clueView),
      objection: g.objection ? { by: g.objection.by, team: g.objection.team, turn: g.objection.turn } : null,
      last: g.last,
      winner: g.winner,
      ended: g.ended,
      stoppedBy: g.stoppedBy,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
      stats: final ? stats(g) : null,
      nextSpies: final ? [0, 1].map((team) => nextSpy(r, team)?.id ?? null) : null,
    };
  }

  /** The end's numbers: the best clue, the closest call with the assassin, how long it took. */
  function stats(g) {
    let best = null;
    for (const c of g.clues) {
      const hits = c.picks.filter((pick) => pick.key === c.team).length;
      if (hits && (!best || hits > best.hits)) best = { turn: c.turn, hits };
    }
    const assassin = g.key.indexOf('a');
    return {
      best,
      assassin: { card: assassin, marks: g.assassinMarks, revealed: Boolean(g.revealed[assassin]) },
      clues: [0, 1].map((team) => g.clues.filter((c) => c.team === team).length),
      ms: (g.endedAt ?? clock.now()) - g.startedAt,
    };
  }

  function broadcast(r) {
    for (const s of r.subscribers) {
      const p = s.player ? r.players.get(s.player) : null;
      s.send('view', JSON.stringify(view(r, p)));
    }
  }

  // ---- seats --------------------------------------------------------------------------------

  /** Puts a player in a seat; a spymaster's seat already taken swaps its holder to operative. */
  function seat(r, p, team, role) {
    if (team === null) {
      p.team = null;
      p.role = 'op';
      return;
    }
    if (role === 'spy') {
      const current = spymaster(r, team);
      if (current && current !== p) current.role = 'op';
    }
    p.team = team;
    p.role = role;
  }

  /** Who'd be the team's spymaster next: the one after the current one, in the order they joined. */
  function nextSpy(r, team) {
    const members = teamOf(r, team);
    if (members.length < 2) return members[0] ?? null;
    const at = members.findIndex((p) => p.role === 'spy');
    return members[(at + 1) % members.length];
  }

  function rotate(r) {
    for (const team of [0, 1]) {
      const next = nextSpy(r, team);
      if (next) seat(r, next, team, 'spy');
    }
  }

  /** Everyone playing into two even teams, at random, each with a random spymaster. */
  function shuffleTeams(r) {
    const playing = shuffle(
      present(r).filter((p) => p.team !== null),
      randomInt,
    );
    playing.forEach((p, i) => {
      p.team = i % 2;
      p.role = 'op';
    });
    for (const team of [0, 1]) {
      const members = teamOf(r, team);
      const people = members.filter((p) => !p.bot);
      const pick = (people.length ? people : members)[0];
      if (pick) pick.role = 'spy';
    }
  }

  // ---- host and housekeeping ----------------------------------------------------------------

  function handOver(r) {
    const host = r.players.get(r.host);
    if (host && !host.left && host.online > 0) return;
    const next = present(r).find((p) => !p.bot && p.online > 0);
    if (next && next.id !== r.host) {
      r.host = next.id;
      touch(r);
    }
  }

  function removePlayer(r, p) {
    if (r.phase === 'lobby') r.players.delete(p.id);
    else p.left = true;
    p.online = 0;
    const people = present(r).filter((q) => !q.bot);
    if (!people.length) {
      clearTimers(r);
      rooms.delete(r.code);
      for (const s of r.subscribers) s.send('view', JSON.stringify({ code: r.code, phase: 'gone' }));
      return;
    }
    if (r.host === p.id) r.host = (people.find((q) => q.online > 0) ?? people[0]).id;
    if (r.phase === 'play') {
      const g = r.game;
      // A team that lost its spymaster waits for the host to seat a new one.
      if (p.role === 'spy' && p.team !== null && !spymaster(r, p.team)) r.notice = 'spy-gone';
      if (!teamOf(r, 0).length || !teamOf(r, 1).length) return finish(r, null, 'left');
      if (g.objection?.by === p.id) g.objection = null;
    }
    touch(r);
  }

  return {
    get size() {
      return rooms.size;
    },

    /** @param {{ name: unknown, avatar?: unknown, key?: unknown }} body */
    create({ name, avatar, key }) {
      // A retry of the same "New game" (the first try timed out on the page): the same room and seat.
      const again = keyedSeat(key);
      if (again) return again;
      if (!cleanName(name)) throw new GameError('name');
      if (rooms.size >= LIMITS.rooms || !within(created, 10 * 60_000, LIMITS.roomsPer10Min)) throw new GameError('busy', 429);
      const code = newCode();
      const r = {
        code,
        created: clock.now(),
        touched: clock.now(),
        /** Since when no human has been online during a game (null while someone is). */
        unwatchedSince: null,
        version: 0,
        host: '',
        players: new Map(),
        settings: { ...DEFAULT_SETTINGS, packs: [...DEFAULT_SETTINGS.packs] },
        customCount: 0,
        phase: 'lobby',
        game: null,
        games: 0,
        /** Games won this evening, per team. */
        tally: [0, 0],
        notice: null,
        timers: new Set(),
        subscribers: new Set(),
      };
      rooms.set(code, r);
      const p = addPlayer(r, name, avatar);
      r.host = p.id;
      // The room's first player gives the clues for team 0 until someone else wants to.
      p.role = 'spy';
      return remember(key, { code, player: p.id, token: p.token });
    },

    /** A quick look before joining: does the room exist, and is it open? */
    info(code) {
      const r = rooms.get(String(code ?? '').toUpperCase());
      if (!r) return null;
      return { code: r.code, phase: r.phase, players: present(r).length, full: present(r).length >= LIMITS.players };
    },

    /**
     * Joins, or comes back: a known token gets the same seat again. A token alone that no longer
     * fits (kicked, or dropped from the lobby) is refused. `key`: a retried join gets the same seat.
     * @param {{ name?: unknown, avatar?: unknown, token?: unknown, key?: unknown }} body
     */
    join(code, { name, avatar, token, key }) {
      const r = room(code);
      const again = keyedSeat(key, r.code);
      if (again) return again;
      if (typeof token === 'string' && token) {
        for (const p of r.players.values()) {
          if (p.token === token && !p.left && !p.bot) return { code: r.code, player: p.id, token: p.token };
        }
        if (!cleanName(name)) throw new GameError('no-player', 401);
      }
      const p = addPlayer(r, name, avatar);
      touch(r);
      return remember(key, { code: r.code, player: p.id, token: p.token });
    },

    view(code, playerId = null) {
      const r = room(code);
      return view(r, playerId ? (r.players.get(playerId) ?? null) : null);
    },

    /**
     * Streams the room to one page: its view now and after every change ('view'), and reactions
     * ('react'). Returns the unsubscribe function.
     * @param {(event: string, data: string) => void} send
     */
    subscribe(code, playerId, send) {
      const r = room(code);
      const p = r.players.get(String(playerId ?? ''));
      const me = p && !p.left && !p.bot ? p : null;
      /** @type {Subscriber} */
      const sub = { player: me?.id ?? null, send };
      r.subscribers.add(sub);
      if (me) {
        me.online++;
        me.offlineSince = null;
      }
      send('view', JSON.stringify(view(r, me)));
      if (me && me.online === 1) touch(r);
      return () => {
        if (!r.subscribers.delete(sub)) return;
        if (me && !me.left) {
          me.online = Math.max(0, me.online - 1);
          if (me.online === 0) {
            me.offlineSince = clock.now();
            touch(r);
            // Their team's bots take over the guessing if nobody else is there.
            botsPlay(r);
          }
        }
      };
    },

    /**
     * A player's move. Throws GameError for anything not allowed right now.
     * @param {string} code  @param {unknown} token  @param {string} action  @param {any} body
     */
    act(code, token, action, body = {}) {
      const r = room(code);
      const p = player(r, token);
      r.touched = clock.now();
      const g = r.game;
      const t = g?.turn;

      switch (action) {
        case 'settings': {
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          r.settings = mergeSettings(r.settings, body);
          r.customCount = parseCustom(r.settings.custom).length;
          r.notice = null;
          touch(r);
          return;
        }
        case 'seat': {
          // Your own seat: a team (0, 1) as spymaster or operative, or watching (team null).
          requirePhase(r, 'lobby', 'final');
          const team = body?.team ?? null;
          const role = body?.role === 'spy' ? 'spy' : 'op';
          if (team !== null && team !== 0 && team !== 1) throw new GameError('team');
          const current = team === null ? null : spymaster(r, team);
          if (role === 'spy' && current && current !== p) throw new GameError('spy-taken', 409);
          seat(r, p, team, role);
          touch(r);
          return;
        }
        case 'move': {
          // The host seats anyone, at any time: a new spymaster mid-game when one has gone.
          requireHost(r, p);
          const target = r.players.get(String(body?.player ?? ''));
          if (!target || target.left) throw new GameError('no-player', 404);
          const team = body?.team ?? null;
          if (team !== null && team !== 0 && team !== 1) throw new GameError('team');
          if (r.phase === 'play' && team === null && target.role === 'spy') throw new GameError('spy-needed', 409);
          seat(r, target, team, body?.role === 'spy' ? 'spy' : 'op');
          if (r.phase === 'play') r.notice = spymaster(r, 0) && spymaster(r, 1) ? null : 'spy-gone';
          touch(r);
          if (r.phase === 'play') botsPlay(r);
          return;
        }
        case 'shuffle': {
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          shuffleTeams(r);
          touch(r);
          return;
        }
        case 'start': {
          requireHost(r, p);
          requirePhase(r, 'lobby');
          startGame(r);
          return;
        }
        case 'clue': {
          requirePhase(r, 'play');
          giveClue(r, p, body);
          return;
        }
        case 'mark': {
          requirePhase(r, 'play');
          mark(r, p, body?.card);
          return;
        }
        case 'reveal': {
          requirePhase(r, 'play');
          reveal(r, p, body?.card);
          return;
        }
        case 'end': {
          // Enough guessing for this clue (after at least one guess, as the rules want).
          requirePhase(r, 'play');
          if (t.phase !== 'guess') throw new GameError('wrong-phase', 409);
          if (p.role !== 'op' || p.team !== t.team) throw new GameError('not-yours', 403);
          if (t.guesses < 1) throw new GameError('guess-first', 409);
          endTurn(r, 'stop');
          return;
        }
        case 'object': {
          // Einspruch: the other team's spymaster thinks the clue breaks the rules; the host decides.
          requirePhase(r, 'play');
          if (!r.settings.objections) throw new GameError('no-objections', 409);
          if (t.phase !== 'guess' || g.objection || t.clue.objected) throw new GameError('wrong-phase', 409);
          if (p.role !== 'spy' || p.team !== 1 - t.team) throw new GameError('not-spy', 403);
          g.objection = { by: p.id, team: p.team, turn: t.n };
          touch(r);
          return;
        }
        case 'rule': {
          requireHost(r, p);
          requirePhase(r, 'play');
          if (!g.objection) throw new GameError('wrong-phase', 409);
          if (body?.uphold === true) return upholdObjection(r);
          g.objection = null;
          t.clue.objected = 'rejected';
          touch(r);
          botsPlay(r);
          return;
        }
        case 'pass': {
          // The host moves the game on: the team whose turn it is passes (a spymaster who's away).
          requireHost(r, p);
          requirePhase(r, 'play');
          if (g.objection) g.objection = null;
          endTurn(r, 'pass');
          return;
        }
        case 'stop': {
          // The host ends the game for everyone: the end screen with the board and the agents found
          // so far, marked as ended early by them (development/plans/end-game.md).
          requireHost(r, p);
          requirePhase(r, 'play');
          r.game.stoppedBy = p.id;
          finish(r, null, 'stopped');
          return;
        }
        case 'rematch': {
          // Again: spymasters move on to the next player in each team; straight into a new game,
          // or back to the lobby to change teams and settings.
          requireHost(r, p);
          requirePhase(r, 'final');
          clearTimers(r);
          for (const q of [...r.players.values()]) if (q.left) r.players.delete(q.id);
          if (body?.rotate !== false) rotate(r);
          r.game = null;
          r.notice = null;
          if (body?.lobby) {
            r.phase = 'lobby';
            touch(r);
            return;
          }
          r.phase = 'lobby';
          try {
            startGame(r);
          } catch (error) {
            touch(r);
            throw error;
          }
          return;
        }
        case 'bot': {
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          const bots = present(r).filter((q) => q.bot);
          if (body?.add) {
            if (bots.length >= LIMITS.bots) throw new GameError('bots', 409);
            const used = new Set(bots.map((b) => b.name));
            const name = BOT_NAMES.find((n) => !used.has(n)) ?? BOT_NAMES[0];
            const bot = addPlayer(r, name, randomAvatar(random), true);
            if (body?.team === 0 || body?.team === 1) seat(r, bot, body.team, body?.role === 'spy' ? 'spy' : 'op');
            touch(r);
          } else {
            const target = body?.player ? r.players.get(String(body.player)) : bots.at(-1);
            if (target?.bot) removePlayer(r, target);
          }
          return;
        }
        case 'react': {
          const e = body?.e;
          if (!Number.isInteger(e) || e < 0 || e >= REACTIONS.length) throw new GameError('react');
          // A poker face: a spymaster can't react while their own team is guessing.
          if (r.phase === 'play' && t?.phase === 'guess' && p.role === 'spy' && p.team === t.team) throw new GameError('poker-face', 409);
          const now = clock.now();
          if (now - p.reacted < REACT_GAP) return;
          p.reacted = now;
          const data = JSON.stringify({ player: p.id, e });
          for (const s of r.subscribers) s.send('react', data);
          return;
        }
        case 'avatar': {
          p.avatar = cleanAvatar(body?.avatar, random);
          touch(r);
          return;
        }
        case 'kick': {
          requireHost(r, p);
          const target = r.players.get(String(body?.player ?? ''));
          if (!target || target.left || target.id === p.id) throw new GameError('no-player', 404);
          removePlayer(r, target);
          return;
        }
        case 'leave': {
          removePlayer(r, p);
          return;
        }
        default:
          throw new GameError('unknown-action', 404);
      }
    },

    /**
     * Housekeeping, every few seconds: hand the host's seat on, drop people who closed the page in
     * the lobby, end a game nobody is watching, forget empty rooms, and catch a lost clock.
     */
    tick() {
      const now = clock.now();
      for (const r of rooms.values()) {
        const online = present(r).filter((p) => !p.bot && p.online > 0);
        if ((!online.length && now - r.touched > EMPTY_TTL) || now - r.touched > IDLE_TTL) {
          clearTimers(r);
          for (const s of r.subscribers) s.send('view', JSON.stringify({ code: r.code, phase: 'gone' }));
          rooms.delete(r.code);
          continue;
        }
        if (r.phase === 'play') {
          if (online.length) r.unwatchedSince = null;
          else {
            r.unwatchedSince ??= now;
            if (now - r.unwatchedSince >= UNWATCHED_MS) {
              r.unwatchedSince = null;
              finish(r, null, 'left');
              continue;
            }
          }
          const g = r.game;
          const t = g.turn;
          if (t?.endsAt && !g.objection && now >= t.endsAt + 2000) endTurn(r, 'time');
        }
        const host = r.players.get(r.host);
        if (host && host.online === 0 && host.offlineSince !== null && now - host.offlineSince >= HOST_GRACE) handOver(r);
        if (r.phase === 'lobby') {
          for (const p of present(r)) {
            if (!p.bot && p.id !== r.host && p.online === 0 && p.offlineSince !== null && now - p.offlineSince >= LOBBY_GRACE) removePlayer(r, p);
          }
        }
      }
    },

    /** Stops every timer (shutdown, tests). */
    close() {
      for (const r of rooms.values()) {
        clearTimers(r);
        r.subscribers.clear();
      }
      rooms.clear();
    },
  };
}

/**
 * A display name: printable, single-spaced, at most LIMITS.name characters (graphemes, so an emoji
 * counts as one). Empty when nothing usable is left.
 */
export function cleanName(raw) {
  return cleanText(raw, LIMITS.name);
}

/** Printable, single-spaced text of at most `max` graphemes. */
export function cleanText(raw, max) {
  if (typeof raw !== 'string') return '';
  const text = raw
    .slice(0, max * 8)
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Co}\p{Cn}]|(?!‍)\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const graphemes = [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return graphemes.slice(0, max).join('').trim();
}

/** The settings with a host's changes applied; anything invalid is ignored. */
export function mergeSettings(current, body) {
  const next = { ...current, packs: [...current.packs] };
  if (CARD_KINDS.includes(body?.cards)) next.cards = body.cards;
  if (LANGS.includes(body?.lang)) next.lang = body.lang;
  if (Array.isArray(body?.packs)) next.packs = PACKS.filter((key) => body.packs.includes(key));
  if (typeof body?.custom === 'string') next.custom = parseCustom(body.custom).join(', ');
  if (MIXES.includes(body?.mix)) next.mix = body.mix;
  if (CLOCKS.includes(body?.clock)) next.clock = body.clock;
  if (CLUE_SECONDS.includes(body?.clueSeconds)) next.clueSeconds = body.clueSeconds;
  if (GUESS_SECONDS.includes(body?.guessSeconds)) next.guessSeconds = body.guessSeconds;
  if (BONUS_SECONDS.includes(body?.firstBonus)) next.firstBonus = body.firstBonus;
  if (CHECKS.includes(body?.checks)) next.checks = body.checks;
  if (typeof body?.objections === 'boolean') next.objections = body.objections;
  if (AGREE.includes(body?.agree)) next.agree = body.agree;
  return next;
}
