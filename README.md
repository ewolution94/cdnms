# CDNMS

One word, a number, and a board of cards: our own Codenames for the afternoon meeting, with word
cards, picture cards or both, mostly played on a video call. Live at
[cdnms.ewolution.cloud](https://cdnms.ewolution.cloud).

- **Two teams, one spymaster each.** Only the spymasters see the key: which cards are their team's
  agents, which are bystanders, which one is the assassin. In turn, a spymaster gives one word and a
  number; their team turns cards over, one at a time, up to the number plus one. Their own agent: go
  on. A bystander or the other team's agent: the turn passes. The assassin: game lost. The first team
  to find all its agents wins.
- **Rooms with a code:** the host starts a game and gets a four-letter code (no vowels, so it never
  spells a word) and a link like `cdnms.ewolution.cloud/KXPT`, with a QR code. No accounts: a name
  and a face are enough, and a reload or a locked phone puts you back in your seat. Players pick a
  team and a seat in the lobby; the host can shuffle, add bots and seat anyone.
- **Boards:** 25 words (5 × 5), 20 pictures (5 × 4, as in Codenames Pictures) or 13 words and 12
  pictures. Every picture card is two line motifs put together (a fish in a light bulb, a crown on a
  cloud), drawn by the page from `server/pictures/`, so a card points in more than one direction.
- **The spymaster picks cards, the number follows.** Tapping the cards a clue is meant for sets the
  number (until it's set by hand; 0 and ∞ are a tap away). The clue is checked as it's typed with the
  server's own rules: one word, not on the board, in strict mode not part of a word on the board
  either. "Senden" types it out big with three seconds to take it back.
- **Operatives point, then hold.** A tap puts your face on a card for everyone to see; turning it
  over takes a hold on "Halten zum Aufdecken" (a ring fills), so a slip never costs the game. The host
  can make two pointers necessary.
- **What was meant:** at the end, every clue shows the cards its spymaster meant beside the cards the
  team picked, with the whole key, the best clue, the closest call with the assassin and the
  evening's tally. "Nochmal" moves the spymaster's seat on to the next player in each team.
- **The key never leaks:** each page's stream carries only what that player may see (operatives,
  spectators and the big screen get the revealed cards only). A spymaster can hide the key on their
  own screen for screen sharing and hold an eye to peek. A spymaster whose team is guessing can't
  react: a poker face.
- **Einspruch:** the other team's spymaster can object to a clue; the host decides. Upheld, the turn
  ends and the objecting team gets one of its agents covered, as the rules have it.
- **Clocks:** off, quick (60 s for a clue, 90 s to guess, the first clue 30 s more) or set by the host.
- **The big screen** (`/<code>/screen`): the board as the operatives see it, the clue, the teams and
  the log; the key only at the end. For a projector or the window the host shares on a call. The
  lobby offers it on wider screens only: a phone is never the big screen.
- **The look: Akte**, the case file. Manila folders, index cards, stencil lettering for headings, plain
  Geist for the card words (they must read at a glance on a phone) and a typewriter for the clues; the teams in the office's own inks, Grünstift green (a circle) and Kopierstift violet
  (a square), so the key never depends on colour alone. Light only.
- German and English; the word language is a room setting.

## How it works

- **The server keeps the game.** Rooms live in memory (`server/game.mjs`): players, seats, the board,
  the key, the turn, the clues and what each was meant for. A deploy ends running games; a game with
  no one online for two minutes ends, and an empty room is forgotten after half an hour.
- **SSE down, JSON moves up** (`server/api.mjs`). Each page holds one `EventSource` with two named
  events: `view` (the room as this page may see it, built per player) and `react`. Everything else is
  a small POST with the seat's token in `x-cdnms-token`.
- **Clue checks** live in `server/clue.mjs`, imported by the server and by the spymaster's page alike.
- **Bots** play in the server: a bot spymaster gives a harmless word for one or two of its cards, bot
  operatives guess (usually what was meant) when no person on their team is online. They're there to
  try it alone and for the tests.
- **Words:** about 410 per language, written for the game, by theme (`server/words/de.mjs`,
  `en.mjs`), most with two meanings; no word on a list contains another. Work-safe.
- **Picture motifs:** 165 line drawings on a 24-unit grid (`server/pictures/motifs.mjs`), 49 with a
  hollow where a second motif fits.
- **Faces:** Folio's emblems in their doodle theme (`<ewo-emblem>`, `<ewo-emblem-maker>`, shared with
  Kritzle), dressed as mugshots clipped into the file.
- **Visit counts:** `/_e.js` and `/_e` are forwarded to Census over the shared Docker network
  (`server/census.mjs`), adding only `X-Site: cdnms`. Without `CDNMS_CENSUS` (local runs) the
  forwarder answers with an empty beacon and counts nothing.

## Run it

```bash
npm install
npm run dev          # http://localhost:6250, the game server included
npm run check        # svelte-check / TypeScript
npm test             # unit tests: the game, clue checks, words, pictures, Census (Node 24+)
npm run build && npm start   # production server on :8080 (or --port 6251)
```

## Deploy (NAS)

This mirrors Schätzle, Vollmond and Kritzle:

- `ci.yml` runs the typecheck, the tests and the build, then smoke-tests the production server (page,
  headers, a room with a second player and bots, a started mixed game on the big screen's stream
  without the key, a clue refused for being on the board).
- `docker-publish.yml` gates on `ci.yml`, then pushes `ghcr.io/ewolution94/cdnms:latest` for amd64 and
  arm64.
- The shared Watchtower picks the image up. A push to `release` is the whole deploy, and it ends any
  game in progress: don't push during the afternoon meeting.
- The NAS runs `deploy/portainer-stack.yml`, on the port the workspace's registry holds for it.
- The stack joins the external Docker network `ewolution`, where Census listens as `census:4901`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `--port` | `8080` | Listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `CDNMS_CENSUS` | off | Census's ingest origin, `http://census:4901` on the NAS |

## Project layout

```
server/server.mjs         static files + security headers, wires the rest; no dependencies
server/game.mjs           rooms, seats, the board and key, turns, clues, guesses, clocks, Einspruch,
                          bots, each player's view (no I/O; tested with a fake clock)
server/api.mjs            the game over HTTP: JSON moves, the SSE stream
server/clue.mjs           the clue checks, shared with the spymaster's page
server/words/             the word lists and a board's draw
server/pictures/          the motifs, a picture board's deal, the layout of a card's two motifs
server/avatar.mjs         a face's five numbers
server/census.mjs         forwards /_e.js and /_e to Census (visit counts)
src/lib/room.svelte.ts    the live room: the stream, reconnects, moves
src/lib/cards.ts          drawing a picture card, a card's name
src/lib/sound.svelte.ts   the sounds, synthesised with Web Audio
src/components/           Home, Join, AvatarMaker, Game → Lobby, Play (ClueBar, Board, Card,
                          SpyDock, Dock, Hold, Log, Teams), Final; Screen (the big screen)
public/                   the icon, the offline worker
```
