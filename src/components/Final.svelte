<!--
  The end: the verdict stamped on the file, the whole key, what every clue was meant for beside what
  the team picked, a few numbers, the evening's tally, and "Nochmal" with the next spymasters.
-->
<script lang="ts">
  import { ApiError, type View } from '../lib/api';
  import { errorText, names, t, teamName } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import Board from './Board.svelte';
  import Log from './Log.svelte';

  let { room, view, onleave }: { room: Room; view: View; onleave: () => void } = $props();

  let error = $state('');
  let busy = $state(false);

  const game = $derived(view.game!);
  const isHost = $derived(view.me === view.host);
  const hostName = $derived(view.players.find((p) => p.id === view.host)?.name ?? '');
  const winner = $derived(game.winner);
  const verdict = $derived(
    winner === null
      ? game.ended === 'left'
        ? t('endLeft')
        : t('endStopped')
      : game.ended === 'assassin'
        ? t('endAssassin', { team: teamName((1 - winner) as 0 | 1) })
        : t('endAgents', { n: game.total[winner] }),
  );
  const nextNames = $derived(
    (game.nextSpies ?? []).flatMap((id) => {
      const p = view.players.find((x) => x.id === id);
      return p ? [p.name] : [];
    }),
  );
  const best = $derived(game.stats?.best ? game.clues.find((c) => c.turn === game.stats!.best!.turn) : null);
  const minutes = $derived(Math.max(1, Math.round((game.stats?.ms ?? 0) / 60_000)));

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

<div class="final">
  <section class="sheet ruled verdict" class:w0={winner === 0} class:w1={winner === 1}>
    <span class="label">{t('room')} {view.code}</span>
    {#if winner !== null}
      <h1 class="stencil"><span class="shape t{winner}"></span>{t('wins', { team: teamName(winner) })}</h1>
      <span class="stamp solved" aria-hidden="true">{t('solved')}</span>
    {:else}
      <h1 class="stencil">{verdict}</h1>
    {/if}
    {#if winner !== null}<p class="why">{verdict}</p>{/if}
    <p class="tally">
      <span class="label">{t('tally')}</span>
      <span class="shape t0"></span><b>{view.tally[0]}</b>
      <span class="sep">:</span>
      <b>{view.tally[1]}</b><span class="shape t1"></span>
    </p>
  </section>

  <div class="grid">
    <section class="boardbox" aria-label={t('theKey')}>
      <Board {game} players={view.players} showKey />
    </section>
    <section class="sheet meant">
      <h2 class="label">{t('whatMeant')}</h2>
      <Log {view} meantAlways />
    </section>
  </div>

  <div class="stats">
    {#if best && game.stats?.best}
      <span class="chip">{t('bestClue', { clue: `${best.word.toUpperCase()} ${best.number === 'inf' ? '∞' : best.number}`, n: game.stats.best.hits })}</span>
    {/if}
    {#if game.stats && game.stats.assassin.marks > 0 && !game.stats.assassin.revealed}
      <span class="chip">{game.stats.assassin.marks === 1 ? t('oneCloseCall') : t('closeCall', { n: game.stats.assassin.marks })}</span>
    {/if}
    <span class="chip">{t('duration', { n: game.clues.length, m: minutes })}</span>
  </div>

  <div class="actions">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if isHost}
      <button class="btn primary block" type="button" disabled={busy} onclick={() => act('rematch')}>
        {nextNames.length ? t('againRotate', { names: names(nextNames) }) : t('again')}
      </button>
      <button class="btn block" type="button" disabled={busy} onclick={() => act('rematch', { lobby: true })}>{t('changeTeams')}</button>
    {:else}
      <p class="wait">{t('waitAgain', { name: hostName })}</p>
    {/if}
    <button class="btn quiet" type="button" onclick={onleave}>{t('leaveGame')}</button>
  </div>
</div>

<style>
  .final {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 1100px;
    margin: 8px auto 0;
  }
  .verdict {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 16px 14px;
    overflow: hidden;
  }
  .verdict .label {
    line-height: 24px;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 0;
    font-size: clamp(30px, 8vw, 46px);
    line-height: 1;
  }
  h1 .shape {
    width: 18px;
    height: 18px;
  }
  .w0 h1 {
    color: var(--t0);
  }
  .w1 h1 {
    color: var(--t1);
  }
  .solved {
    position: absolute;
    right: 16px;
    bottom: 16px;
    font-size: clamp(14px, 3.4vw, 20px);
    animation: slam 520ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 250ms both;
  }
  .w0 .solved {
    color: var(--t0);
  }
  .w1 .solved {
    color: var(--t1);
  }
  @keyframes slam {
    from {
      opacity: 0;
      transform: rotate(-16deg) scale(2);
    }
    to {
      opacity: 0.86;
      transform: rotate(-7deg) scale(1);
    }
  }
  .why {
    margin: 0;
    font: 400 16px/1.3 var(--type);
  }
  .tally {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 0;
  }
  .tally .label {
    margin-right: 4px;
  }
  .tally b {
    font: 800 20px/1 var(--stencil);
  }
  .sep {
    font-weight: 700;
  }
  .grid {
    display: grid;
    gap: 16px;
  }
  .boardbox {
    height: min(72vw, 560px);
  }
  .meant {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
  }
  .meant h2 {
    margin: 0;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
      align-items: start;
    }
    .boardbox {
      height: min(48vw, 520px);
    }
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .stats .chip {
    min-height: 32px;
    font-size: 13px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
  }
  .actions .btn.primary {
    white-space: normal;
    padding-block: 10px;
    line-height: 1.15;
  }
  .wait {
    margin: 0;
    color: var(--mute);
  }
  .error {
    margin: 0;
  }
</style>
