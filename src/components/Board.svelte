<!--
  The board: 5 × 5 words, 5 × 4 pictures, or both. It keeps its cards' shape and takes as much of
  the space it's given as fits (a size container), so the same board serves a phone, a laptop beside
  the call and the big screen. Turned-over cards stamp down as they change; the assassin shakes the
  board once.
-->
<script lang="ts">
  import type { Game, Key, Player } from '../lib/api';
  import Card from './Card.svelte';

  let {
    game,
    players,
    showKey = false,
    selected = [],
    myMark = null,
    team = null,
    interactive = () => false,
    onpick,
  }: {
    game: Game;
    players: Player[];
    /** Show the key on hidden cards (a spymaster, or the end). */
    showKey?: boolean;
    selected?: number[];
    myMark?: number | null;
    team?: 0 | 1 | null;
    interactive?: (index: number) => boolean;
    onpick?: (index: number) => void;
  } = $props();

  /** Cards turned over since this board last looked, for the stamp. */
  let fresh: Set<number> = $state(new Set());
  let seen: (Key | null)[] | null = null;
  let shake = $state(false);
  let seenGame = 0;

  $effect(() => {
    const now = game.revealed.map((r) => r?.key ?? null);
    if (seen && seenGame === game.n) {
      const next = new Set<number>();
      now.forEach((k, i) => {
        if (k !== null && seen![i] === null) next.add(i);
      });
      if (next.size) {
        fresh = next;
        if ([...next].some((i) => now[i] === 'a')) {
          shake = true;
          setTimeout(() => (shake = false), 700);
        }
        setTimeout(() => (fresh = new Set()), 900);
      }
    }
    seen = now;
    seenGame = game.n;
  });

  const byId = $derived(new Map(players.map((p) => [p.id, p])));
  // A card is at most this wide for its height (when the space is short) and at least this tall
  // (when there's room): words like a wide index card, pictures nearer a square.
  const wide = $derived(game.kind === 'words' ? 1.7 : 1.45);
  const tall = $derived(game.kind === 'words' ? 1 : 0.85);
</script>

<div class="fit">
  <div
    class="board"
    class:shake
    style="--cols:{game.cols}; --rows:{game.rows}; --wide:{(game.cols * wide) / game.rows}; --tall:{(game.cols * tall) / game.rows}"
    role="group"
  >
    {#each game.cards as card, i (i)}
      <Card
        {card}
        revealed={game.revealed[i]}
        keyed={showKey && game.key && !game.revealed[i] ? game.key[i] : null}
        selected={selected.includes(i)}
        mine={myMark === i}
        marks={(game.marks[i] ?? []).map((id) => byId.get(id)).filter((p): p is Player => Boolean(p))}
        fresh={fresh.has(i)}
        interactive={interactive(i)}
        {team}
        onpick={() => onpick?.(i)}
      />
    {/each}
  </div>
</div>

<style>
  .fit {
    container-type: size;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
    gap: clamp(5px, 1.6cqw, 12px);
    width: min(100cqw, 100cqh * var(--wide));
    height: min(100cqh, min(100cqw, 100cqh * var(--wide)) / var(--tall));
  }
  .shake {
    animation: shake 600ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  @keyframes shake {
    10%,
    90% {
      transform: translateX(-1px);
    }
    20%,
    80% {
      transform: translateX(3px);
    }
    30%,
    50%,
    70% {
      transform: translateX(-6px);
    }
    40%,
    60% {
      transform: translateX(6px);
    }
  }
</style>
