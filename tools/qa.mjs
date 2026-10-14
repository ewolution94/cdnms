// CDNMS QA: a host and a guest on one team, bots on the other, walked through every screen: home (the
// rules open, Settings), the join page, the lobby (the QR code, a player's menu), a spymaster's clue
// (cards chosen, a word typed), the operatives' guess (a pointer, a card turned over), the log, the host
// menu, the end screen, and the big screen at 1920 × 1080. Each shot checks for anything past the right
// edge and console errors; AUDIT=1 also checks that every label sits in the middle of its box
// (tools/text-audit.mjs, development/plans/text-centering.md). Not part of CI: Playwright is borrowed
// from Folio's checkout next door (the workspace's `folio/node_modules`, WebKit already installed).
//
//   npm run build && node server/server.mjs --port 6251     (or the cdnms-prod preview)
//   node tools/qa.mjs [base] [outdir]          W=390 H=844 LANG_UI=de CARDS=words by default
//   AUDIT=1 node tools/qa.mjs …                  plus the text audits at every shot
import { webkit } from '../../folio/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { digitAudit, textAudit } from './text-audit.mjs';

const BASE = process.argv[2] ?? 'http://localhost:6251';
const OUT = process.argv[3] ?? '/tmp/cdnms-qa/';
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844);
const LANG = process.env.LANG_UI ?? 'de';
const CARDS = process.env.CARDS ?? 'words';
/** Text off its box's middle by this many px or more, at every shot (tools/text-audit.mjs). */
const AUDIT = process.env.AUDIT ? Number(process.env.AUDIT) : 0;
// A log entry is a row with the clue on top and the guesses under it, not a centred label.
const AUDIT_SKIP = ['li.entry'];
const offCentre = new Map();
const oldDigits = new Map();
mkdirSync(OUT, { recursive: true });

const problems = [];
const say = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await webkit.launch();

async function person(name, viewport = { width: W, height: H }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await context.addInitScript((lang) => {
    try {
      localStorage.setItem('ewo:lang', lang);
      localStorage.setItem('cdnms:sound', 'off');
    } catch {}
  }, LANG);
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name}: page error: ${e.message}`));
  return { name, context, page, seat: null };
}

let n = 0;
async function shot(p, label) {
  await sleep(700); // entrances and the stream's next view
  const file = `${OUT}${String(++n).padStart(2, '0')}-${p.name}-${label}.png`;
  await p.page.screenshot({ path: file, fullPage: true });
  const wide = await p.page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 0.5).slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.'));
  });
  if (wide.length) problems.push(`${p.name} ${label}: past the right edge: ${wide.join(', ')}`);
  if (AUDIT) {
    for (const row of await p.page.evaluate(textAudit, { min: AUDIT, skip: AUDIT_SKIP })) {
      const key = `${row.where} | ${row.text}`;
      if (!offCentre.has(key)) offCentre.set(key, { ...row, at: `${p.name} ${label}` });
    }
    for (const row of await p.page.evaluate(digitAudit)) {
      const key = `${row.where} | ${row.text}`;
      if (!oldDigits.has(key)) oldDigits.set(key, { ...row, at: `${p.name} ${label}` });
    }
  }
  say(`  shot ${file.slice(OUT.length)}`);
}

// The API, as the page uses it: a move with the seat's token.
async function act(p, action, body = {}) {
  const res = await fetch(`${BASE}/api/rooms/${code}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cdnms-token': p.seat.token },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${p.name} ${action}: ${res.status} ${await res.text()}`);
}

/** One view of the room, as the server sends it to `p` (the first event of a fresh stream). */
async function view(p) {
  const abort = new AbortController();
  const res = await fetch(`${BASE}/api/rooms/${code}/events?p=${p.seat.player}`, { signal: abort.signal });
  const reader = res.body.getReader();
  let text = '';
  for (;;) {
    const { value } = await reader.read();
    text += new TextDecoder().decode(value);
    const m = text.match(/event: view\ndata: (.*)\n\n/);
    if (m) {
      abort.abort();
      return JSON.parse(m[1]);
    }
  }
}

async function until(p, test, what, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await view(p);
    if (test(v)) return v;
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const seatOf = (p) => p.page.evaluate((c) => JSON.parse(localStorage.getItem(`cdnms:seat:${c}`)), code);
const button = (p, text) => p.page.getByRole('button', { name: text, exact: false }).first();

let code = '';
const host = await person('host');
const guest = await person('guest');
try {
  // Home: the maker, the rules, Settings.
  say('home');
  await host.page.goto(BASE);
  await host.page.waitForSelector('ewo-emblem-maker');
  await shot(host, 'home');
  await host.page.locator('details.rules summary').click();
  await shot(host, 'home-rules');
  await host.page.locator('details.rules summary').click();
  await host.page.locator('ewo-settings-button').click();
  await shot(host, 'settings');
  await host.page.keyboard.press('Escape');
  await sleep(400);

  // A room, through the page.
  await host.page.locator('input[autocomplete=nickname]').fill('Eva');
  await host.page.locator('button[type=submit].primary').click();
  await host.page.waitForURL(/\/[A-Z]{4}$/);
  code = new URL(host.page.url()).pathname.slice(1);
  host.seat = await seatOf(host);
  say(`room ${code}`);

  // The guest joins through the join page.
  await guest.page.goto(`${BASE}/${code}`);
  await guest.page.waitForSelector('form button[type=submit]');
  await shot(guest, 'join');
  await guest.page.locator('input[autocomplete=nickname]').fill('Ben');
  await guest.page.locator('form button[type=submit]').click();
  await guest.page.waitForFunction((c) => localStorage.getItem(`cdnms:seat:${c}`), code);
  guest.seat = await seatOf(guest);

  // Teams: Eva spymaster and Ben operative for team 0; bots for team 1, and one more operative for 0.
  await act(host, 'seat', { team: 0, role: 'spy' });
  await act(host, 'move', { player: guest.seat.player, team: 0, role: 'op' });
  await act(host, 'bot', { add: true, team: 1, role: 'spy' });
  await act(host, 'bot', { add: true, team: 1, role: 'op' });
  await act(host, 'bot', { add: true, team: 0, role: 'op' });
  // A clock on, so the turn's timer is shot too.
  await act(host, 'settings', { cards: CARDS, clock: 'custom', clueSeconds: 180, guessSeconds: 240 });
  say('lobby');
  await shot(host, 'lobby');
  await shot(guest, 'lobby');
  await button(host, LANG === 'de' ? 'QR-Code' : 'QR code').click();
  await shot(host, 'lobby-qr');
  await button(host, LANG === 'de' ? 'QR-Code' : 'QR code').click();
  await host.page.locator('button.player').nth(1).click();
  await shot(host, 'player-menu');
  await host.page.keyboard.press('Escape');
  await sleep(400);

  // The big screen, from the start.
  const screen = await person('screen', { width: 1920, height: 1080 });
  await screen.page.goto(`${BASE}/${code}/screen`);
  await shot(screen, 'lobby');

  await act(host, 'start');
  say('play');
  let v = await until(host, (x) => x.game?.turn?.team === 0 && x.game.turn.phase === 'clue', "team 0's clue");
  await shot(host, 'spy-clue');
  await shot(guest, 'op-waiting');
  await shot(screen, 'play');
  // The spymaster chooses two of their agents and types a word: the number follows.
  const mine = v.game.key.map((k, i) => (k === 0 && !v.game.revealed[i] ? i : -1)).filter((i) => i >= 0);
  for (const i of mine.slice(0, 2)) await host.page.locator('.board .card').nth(i).click();
  await host.page.locator('input.clue').fill('Xylofon');
  await shot(host, 'spy-typed');
  await act(host, 'clue', { word: 'Xylofon', number: 2, cards: mine.slice(0, 2) });
  v = await until(guest, (x) => x.game?.turn?.phase === 'guess', 'the guess');
  await shot(guest, 'op-guess');
  await shot(host, 'spy-watching');
  await act(guest, 'mark', { card: mine[0] });
  await act(guest, 'reveal', { card: mine[0] });
  await shot(guest, 'op-after-hit');
  // On a phone the log opens in a sheet; on a wide screen it's a panel beside the board.
  const logButton = guest.page.getByRole('button', { name: LANG === 'de' ? 'Verlauf' : 'Log', exact: false });
  if (await logButton.count()) {
    await logButton.first().click();
    await shot(guest, 'log');
    await guest.page.keyboard.press('Escape');
  }
  await act(guest, 'end');
  await shot(guest, 'op-other-team');
  await host.page.locator('button[aria-label]').filter({ hasText: '⋯' }).click();
  await shot(host, 'host-menu');
  await host.page.keyboard.press('Escape');
  await sleep(400);

  // The end, for everyone.
  await act(host, 'stop');
  await until(host, (x) => x.phase === 'final', 'the end screen');
  await shot(host, 'final');
  await shot(guest, 'final');
  await shot(screen, 'final');
} catch (error) {
  problems.push(`stopped: ${error.message}`);
}
await browser.close();

if (AUDIT) {
  say(`\ntext off its box's middle (≥ ${AUDIT} px; + low, − high; bias = the font's share):`);
  for (const r of offCentre.values()) say(`  ${String(r.off).padStart(5)} (bias ${r.bias})  ${r.font} h${r.height}  ${r.where}  "${r.text}"  [${r.at}]`);
  if (!offCentre.size) say('  none');
  say('old-style digits:');
  for (const r of oldDigits.values()) say(`  ${r.font}  ${r.where}  "${r.text}"  [${r.at}]`);
  if (!oldDigits.size) say('  none');
}
say(problems.length ? `\nproblems:\n  ${problems.join('\n  ')}` : '\nno problems');
process.exit(problems.length || offCentre.size || oldDigits.size ? 1 : 0);
