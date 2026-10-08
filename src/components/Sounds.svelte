<!--
  The game's sounds, from what changes in the view: a clue going out, a card turned over (an agent
  of the guessing team, a bystander, the other team's agent, the assassin), the spymaster's turn,
  the end. Each device plays its own (src/lib/sound.svelte.ts; off in Settings).
-->
<script lang="ts">
  import type { View } from '../lib/api';
  import type { Room } from '../lib/room.svelte';
  import { play, unlockOnGesture } from '../lib/sound.svelte';

  let { room }: { room: Room } = $props();

  let prev: View | null = null;
  unlockOnGesture();

  $effect(() => {
    const v = room.view;
    const before = prev;
    prev = v;
    if (!v?.game || !before?.game || before.game.n !== v.game.n) return;
    const g = v.game;
    const pg = before.game;
    const me = v.players.find((p) => p.id === v.me);
    const turned = g.revealed.findIndex((r, i) => r && !pg.revealed[i] && !r.penalty);
    if (turned >= 0) {
      const k = g.revealed[turned]!.key;
      const guessing = pg.turn?.team;
      if (k === 'a') play.assassin();
      else if (k === 'b') play.bystander();
      else if (k === guessing) play.agent();
      else play.opponent();
    } else if (g.clues.length > pg.clues.length) play.clue();
    else if (v.phase === 'play' && g.turn && g.turn.n !== pg.turn?.n && me?.role === 'spy' && me.team === g.turn.team) play.yourTurn();
    if (v.phase === 'final' && before.phase === 'play' && g.ended !== 'stopped' && g.ended !== 'left') setTimeout(() => play.fanfare(), g.ended === 'assassin' ? 1300 : 500);
  });
</script>
