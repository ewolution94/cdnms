<!--
  Under the board, for everyone who isn't writing a clue: an operative whose team is guessing gets
  the hold to turn over the card they point at and "Zug beenden"; everyone else gets a line on
  what's happening, the other spymaster an Einspruch, and the reactions (never a spymaster whose team
  is guessing: a poker face).
-->
<script lang="ts">
  import { ApiError, type View } from '../lib/api';
  import { cardName } from '../lib/cards';
  import { errorText, t, teamName } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import Hold from './Hold.svelte';

  let { room, view, myMark }: { room: Room; view: View; myMark: number | null } = $props();

  let error = $state('');
  let busy = $state(false);

  const game = $derived(view.game!);
  const turn = $derived(game.turn!);
  const me = $derived(view.players.find((p) => p.id === view.me));
  const spy = $derived(view.players.find((p) => p.team === turn.team && p.role === 'spy'));
  const guessing = $derived(Boolean(me && me.team === turn.team && me.role === 'op' && turn.phase === 'guess'));
  const pokerFace = $derived(Boolean(me && me.role === 'spy' && me.team === turn.team && turn.phase === 'guess'));
  const canObject = $derived(
    Boolean(view.settings.objections && me?.role === 'spy' && me.team === 1 - turn.team && turn.phase === 'guess' && !game.objection && !turn.clue?.objected),
  );
  const markers = $derived(myMark !== null ? (game.marks[myMark]?.length ?? 0) : 0);
  const onlineOps = $derived(view.players.filter((p) => p.team === turn.team && p.role === 'op' && p.online).length);
  const need = $derived(Math.min(view.settings.agree, Math.max(1, onlineOps)));
  const status = $derived(
    pokerFace
      ? t('yourTeamGuesses')
      : turn.phase === 'clue'
        ? me?.team === turn.team
          ? t('waitClue', { name: spy?.name ?? '' })
          : t('otherClue', { name: spy?.name ?? '' })
        : t('otherGuesses', { team: teamName(turn.team) }),
  );

  async function act(action: string, body?: unknown) {
    error = '';
    busy = true;
    try {
      await room.act(action, body);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    } finally {
      busy = false;
    }
  }
</script>

<div class="dock sheet">
  {#if guessing}
    {#if myMark !== null}
      <Hold disabled={busy || markers < need || Boolean(game.objection)} onhold={() => act('reveal', { card: myMark })}>
        <b>{t('holdReveal')}</b>
        <small>{cardName(game.cards[myMark])}{need > 1 ? ` · ${markers}/${need}` : ''}</small>
      </Hold>
    {:else}
      <p class="status">{t('tapCard')}</p>
    {/if}
    <button class="btn block" type="button" disabled={busy || turn.guesses < 1} onclick={() => act('end')}>{t('endTurn')}</button>
  {:else}
    <p class="status">{status}</p>
    {#if canObject}
      <button class="btn small object" type="button" disabled={busy} onclick={() => act('object')}>{t('object')}</button>
    {/if}
  {/if}
  {#if !pokerFace && me}
    <div class="reactions" role="group" aria-label="Reaktionen">
      {#each view.reactions as emoji, e (emoji)}
        <button type="button" class="react" onclick={() => act('react', { e })}>{emoji}</button>
      {/each}
    </div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .dock {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }
  .status {
    margin: 0;
    padding: 6px 2px;
    font-size: 14px;
    line-height: 1.35;
    color: var(--ink-2);
    text-align: center;
  }
  .object {
    align-self: center;
    border-color: var(--stamp);
    color: var(--stamp);
  }
  .reactions {
    display: flex;
    justify-content: center;
    gap: 4px;
  }
  .react {
    width: 40px;
    height: 36px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    font-size: 20px;
    line-height: 1;
    -webkit-tap-highlight-color: transparent;
  }
  .react:active {
    transform: scale(0.9);
  }
  @media (hover: hover) {
    .react:hover {
      background: var(--paper-2);
    }
  }
  .error {
    margin: 0;
    text-align: center;
  }
  :global(.hold b) {
    font: 800 17px/1 var(--stencil);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  :global(.hold small) {
    font-size: 12.5px;
    opacity: 0.8;
  }
</style>
