<!--
  What the turn is about, big and in the middle (learnings/ui-preferences.md → game screens): whose
  turn it is, the clue typed out with its number, the guesses left and the clock. While the
  spymaster thinks, a typewriter cursor waits.
-->
<script lang="ts">
  import type { Player, View } from '../lib/api';
  import { t, teamName } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import Avatar from './Avatar.svelte';
  import Clock from './Clock.svelte';

  let { room, view, big = false }: { room: Room; view: View; big?: boolean } = $props();

  const game = $derived(view.game!);
  const turn = $derived(game.turn!);
  const spy = $derived(view.players.find((p) => p.team === turn.team && p.role === 'spy') as Player | undefined);
  const me = $derived(view.players.find((p) => p.id === view.me));
  const clue = $derived(turn.clue);
  const number = $derived(clue ? (clue.number === 'inf' ? '∞' : String(clue.number)) : '');
  const left = $derived(turn.max === null ? null : turn.max - turn.guesses);
  const mine = $derived(me?.team === turn.team && me.role === 'op' && turn.phase === 'guess');
</script>

<div class="cluebar t{turn.team}" class:big>
  <span class="who">
    <span class="shape t{turn.team}"></span>
    <span class="team">{t('teamName', { team: teamName(turn.team) })}</span>
  </span>
  <div class="clue" aria-live="polite">
    {#if clue}
      {#key clue.turn}
        <span class="word typed">{clue.word}</span>
      {/key}
      <span class="num stencil">{number}</span>
    {:else}
      {#if spy}<Avatar avatar={spy.avatar} size={big ? 34 : 24} />{/if}
      <span class="thinking">{spy && spy.id === view.me ? t('yourClue') : t('thinking', { name: spy?.name ?? '' })}<span class="cursor"></span></span>
    {/if}
  </div>
  <span class="end">
    {#if clue}
      <span class="left" class:mine>
        <span class="label">{t('guessesLabel')}</span>
        <b>{left === null ? t('guessesAny') : left}</b>
      </span>
    {/if}
    {#if turn.endsAt}<Clock {room} endsAt={turn.endsAt} tick={mine || (me?.role === 'spy' && me.team === turn.team && turn.phase === 'clue')} />{/if}
  </span>
</div>

<style>
  .cluebar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 6px 12px 6px 0;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--paper);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .who {
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: -6px 0;
    padding: 0 10px;
    color: var(--t0-ink);
    font: 800 14px/1 var(--stencil);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .t0 .who {
    background: var(--t0);
  }
  .t1 .who {
    background: var(--t1);
  }
  .who .shape {
    background: currentColor;
  }
  .clue {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 12px;
    min-width: 0;
  }
  .word {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: clamp(20px, 6vw, 30px);
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    animation: type-in 420ms steps(6) both;
  }
  @keyframes type-in {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }
  .num {
    font-size: clamp(24px, 7vw, 34px);
    line-height: 1;
  }
  .thinking {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: var(--ink-2);
    align-self: center;
  }
  .clue :global(.av) {
    align-self: center;
  }
  .cursor {
    width: 9px;
    height: 2px;
    margin-top: 10px;
    background: var(--ink);
    animation: blink 1s steps(1) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  .end {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .left .label {
    font-size: 9px;
  }
  .left b {
    font: 800 20px/1 var(--stencil);
  }
  .left.mine b {
    color: var(--stamp);
  }
  @media (max-width: 420px) {
    .who .team {
      display: none;
    }
  }

  /* The big screen and wide layouts: everything a size up. */
  .big {
    min-height: 84px;
  }
  .big .who {
    font-size: 20px;
    padding: 0 18px;
  }
  .big .who .team {
    display: inline;
  }
  .big .word {
    font-size: clamp(30px, 3.4vw, 54px);
  }
  .big .num {
    font-size: clamp(34px, 3.8vw, 58px);
  }
  .big .thinking {
    font-size: 20px;
  }
  .big .left b {
    font-size: 30px;
  }
</style>
