// The server's shapes (server/game.mjs → view) and the calls that change them.

import type { Avatar } from './avatar';

export type Phase = 'lobby' | 'play' | 'final' | 'gone';
export type Team = 0 | 1;
export type Role = 'spy' | 'op';
/** A card on the key: team 0's agent, team 1's, a bystander or the assassin. */
export type Key = 0 | 1 | 'b' | 'a';
export type CardKind = 'words' | 'pictures' | 'mixed';
export type Pack = 'classic' | 'everyday' | 'nature' | 'places' | 'office' | 'culture';
export type WordLang = 'de' | 'en';
export type Mix = 'none' | 'few' | 'half' | 'only';
export type ClockChoice = 'off' | 'quick' | 'custom';
export type Checks = 'strict' | 'relaxed';
export type ClueNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'inf';
export type Composition = 'in' | 'on' | 'pair';

export interface Settings {
  cards: CardKind;
  lang: WordLang;
  packs: Pack[];
  /** The host's own words (empty for everyone else, who only get the count). */
  custom: string;
  customCount: number;
  mix: Mix;
  clock: ClockChoice;
  clueSeconds: number;
  guessSeconds: number;
  firstBonus: number;
  checks: Checks;
  objections: boolean;
  agree: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  /** null: watching */
  team: Team | null;
  role: Role;
  online: boolean;
  bot: boolean;
}

export type Card = { kind: 'word'; text: string } | { kind: 'pic'; a: string; b: string; comp: Composition };

export interface Revealed {
  key: Key;
  by: string | null;
  turn: number;
  /** Covered by an upheld Einspruch, not by a guess. */
  penalty: boolean;
}

export interface Pick {
  card: number;
  key: Key;
  by: string;
}

export type TurnEnd = 'limit' | 'bystander' | 'opponent' | 'stop' | 'time' | 'objection' | 'pass' | 'assassin' | 'agents' | 'stopped' | 'left';

export interface Clue {
  turn: number;
  team: Team;
  word: string;
  number: ClueNumber;
  by: string;
  at: number;
  picks: Pick[];
  /** The cards the spymaster meant: theirs during the game, everyone's at the end. */
  intended: number[] | null;
  ended: TurnEnd | null;
  objected: 'upheld' | 'rejected' | null;
}

export interface Turn {
  n: number;
  team: Team;
  phase: 'clue' | 'guess';
  clue: Clue | null;
  guesses: number;
  /** Guesses allowed for this clue; null for 0 and ∞ (as many as you like). */
  max: number | null;
  endsAt: number | null;
  startedAt: number;
}

export interface Stats {
  best: { turn: number; hits: number } | null;
  assassin: { card: number; marks: number; revealed: boolean };
  clues: [number, number];
  ms: number;
}

export interface Game {
  n: number;
  kind: CardKind;
  cols: number;
  rows: number;
  cards: Card[];
  revealed: (Revealed | null)[];
  /** The spymasters', and everyone's at the end. */
  key: Key[] | null;
  starts: Team;
  /** Agents still hidden, per team. */
  left: [number, number];
  total: [number, number];
  turn: Turn | null;
  /** The guessing team's pointers: card index → player ids. */
  marks: Record<string, string[]>;
  clues: Clue[];
  objection: { by: string; team: Team; turn: number } | null;
  last: { turn: number; team: Team; reason: TurnEnd } | null;
  winner: Team | null;
  ended: TurnEnd | null;
  /** The host who ended the game early ('stopped'). */
  stoppedBy: string | null;
  startedAt: number;
  endedAt: number | null;
  stats: Stats | null;
  nextSpies: [string | null, string | null] | null;
}

export interface View {
  code: string;
  phase: Phase;
  version: number;
  host: string;
  me: string | null;
  settings: Settings;
  notice: string | null;
  players: Player[];
  tally: [number, number];
  game: Game | null;
  reactions: string[];
  now: number;
}

export interface Seat {
  code: string;
  player: string;
  token: string;
}

export interface Config {
  cards: CardKind[];
  langs: WordLang[];
  packs: Pack[];
  counts: Record<WordLang, number>;
  motifs: number;
  custom: { words: number; length: number; text: number; min: number };
  mixes: Mix[];
  clocks: ClockChoice[];
  clueSeconds: number[];
  guessSeconds: number[];
  bonusSeconds: number[];
  checks: Checks[];
  agree: number[];
  numbers: ClueNumber[];
  reactions: string[];
}

/** A refusal from the server ("no-room", "clue-board" …) or a network failure ("offline"). */
/**
 * A refusal from the server ("no-room", "spy-taken" …), a network failure ("offline"), the server or
 * Cloudflare in trouble ("busy": a 5xx without the game's own answer) or no answer in time
 * ("timeout": Folio's track() gave up). The last three are worth "Try again" (waiting.ts).
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: 'no-store' });
  } catch {
    // Given up on (the signal from track()), or the network: Safari says "Load failed", Chrome
    // "Failed to fetch", so classify by type (learnings/ios-and-webkit.md).
    throw new ApiError(init.signal?.aborted ? 'timeout' : 'offline');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const { error, ...detail } = body ?? {};
    // A 5xx without the game's own error is the NAS or Cloudflare (a 502, a 1033 page).
    throw new ApiError(error ?? (response.status >= 500 ? 'busy' : `http-${response.status}`), response.status, detail);
  }
  return body as T;
}

const post = (body: unknown, token?: string, signal?: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-cdnms-token': token } : {}) },
  body: JSON.stringify(body ?? {}),
  signal,
});

/**
 * A deploy restarts the server and ends every room; for a few seconds a create or join can fail.
 * One quiet retry, then the error (learnings/projects/vollmond.md). Safe for create and join: they
 * carry a key, so a retry gets the seat a first try may have made. Not once the page gave up.
 */
async function again<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (signal?.aborted || !(error instanceof ApiError) || (error.code !== 'offline' && error.status < 500)) throw error;
    await new Promise((r) => setTimeout(r, 1500));
    if (signal?.aborted) throw error;
    return fn();
  }
}

export const api = {
  config: () => again(() => request<Config>('/api/config')),
  /** `key`: the same for every try of one "New game", so a retry after a timeout gets the same room. */
  create: (name: string, avatar: Avatar, key?: string, signal?: AbortSignal) =>
    again(() => request<Seat>('/api/rooms', post({ name, avatar, key }, undefined, signal)), signal),
  info: (code: string) => request<{ code: string; phase: Phase; players: number; full: boolean }>(`/api/rooms/${code}`),
  /** `key`: as for create, so a retried join doesn't seat you twice. */
  join: (code: string, name: string, avatar: Avatar | null, token?: string, key?: string, signal?: AbortSignal) =>
    again(() => request<Seat>(`/api/rooms/${code}/join`, post({ name, avatar, token, key }, undefined, signal)), signal),
  act: (seat: Seat, action: string, body?: unknown, signal?: AbortSignal) => request<void>(`/api/rooms/${seat.code}/${action}`, post(body, seat.token, signal)),
};

/** Room codes: four consonants (server/game.mjs → CODE). */
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;
