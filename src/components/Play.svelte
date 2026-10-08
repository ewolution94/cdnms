<!--
  The game: one stage the size of the visible screen (it follows visualViewport, so the keyboard
  never covers the clue field), with the scores on top, the clue bar, the board, and the dock
  under it. On a phone the log and the teams are a sheet away; on a wide screen they sit beside the
  board, one table in the middle (learnings/ui-preferences.md → game screens on a wide monitor).

  Who you are decides what the board does: a spymaster on their turn picks the cards their clue
  means; an operative on their turn points at a card and holds to turn it over; everyone else
  watches. A spymaster sees the key, unless they hide it (for a shared screen) and peek.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError, type Player, type Team, type View } from '../lib/api';
  import { errorText, t, teamName, type Key } from '../lib/i18n.svelte';
  import { prefs } from '../lib/prefs.svelte';
  import type { Room } from '../lib/room.svelte';
  import Board from './Board.svelte';
  import ClueBar from './ClueBar.svelte';
  import Dock from './Dock.svelte';
  import Floats from './Floats.svelte';
  import Log from './Log.svelte';
  import Logo from './Logo.svelte';
  import PlayerMenu from './PlayerMenu.svelte';
  import Settings from './Settings.svelte';
  import SpyDock from './SpyDock.svelte';
  import Teams from './Teams.svelte';

  let { room, view }: { room: Room; view: View } = $props();

  let stage: HTMLElement | undefined = $state();
  let selected: number[] = $state([]);
  /** A pointer sent but not yet echoed (undefined: none pending; null: taken away). */
  let pendingMark: number | null | undefined = $state(undefined);
  let keyHidden = $state(prefs.keyHidden);
  let peek = $state(false);
  let logOpen = $state(false);
  let hostOpen = $state(false);
  let settingsOpen = $state(false);
  let menuFor: string | null = $state(null);
  let toast = $state('');
  let error = $state('');
  let wide = $state(false);

  const game = $derived(view.game!);
  const turn = $derived(game.turn!);
  const me = $derived(view.players.find((p) => p.id === view.me));
  const isHost = $derived(view.me === view.host);
  const isSpy = $derived(Boolean(me && me.role === 'spy' && me.team !== null));
  const myTeam = $derived((me?.team ?? null) as Team | null);
  const writing = $derived(isSpy && turn.team === myTeam && turn.phase === 'clue');
  const guessing = $derived(Boolean(me && me.role === 'op' && turn.team === myTeam && turn.phase === 'guess'));
  const showKey = $derived(isSpy && (!keyHidden || peek));
  const serverMark = $derived.by(() => {
    for (const [card, ids] of Object.entries(game.marks)) if (view.me && ids.includes(view.me)) return Number(card);
    return null;
  });
  const myMark = $derived(guessing ? (pendingMark !== undefined ? pendingMark : serverMark) : null);
  const objector = $derived(game.objection ? view.players.find((p) => p.id === game.objection!.by) : null);
  const hostName = $derived(view.players.find((p) => p.id === view.host)?.name ?? '');
  const menuPlayer = $derived(view.players.find((p) => p.id === menuFor) ?? null);

  // The server's pointer took over.
  $effect(() => {
    if (pendingMark !== undefined && pendingMark === serverMark) pendingMark = undefined;
  });

  // A new turn: the spymaster's choice starts empty, the pointer too; say how the last one ended.
  let seenTurn = 0;
  $effect(() => {
    const n = turn.n;
    if (n === seenTurn) return;
    const first = seenTurn === 0;
    seenTurn = n;
    selected = [];
    pendingMark = undefined;
    const last = game.last;
    if (!first && last && last.turn === n - 1) {
      toast = t(`last_${last.reason}` as Key, { team: teamName(turn.team) });
      setTimeout(() => (toast = ''), 3600);
    }
  });

  function interactive(i: number) {
    if (game.revealed[i]) return false;
    if (writing) return game.key?.[i] === myTeam;
    return guessing;
  }

  function pick(i: number) {
    if (writing) {
      selected = selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i];
      return;
    }
    if (!guessing) return;
    pendingMark = myMark === i ? null : i;
    room.act('mark', { card: i }).catch((e) => {
      pendingMark = undefined;
      error = errorText(e instanceof ApiError ? e.code : 'other');
      setTimeout(() => (error = ''), 3000);
    });
  }

  async function act(action: string, body?: unknown) {
    error = '';
    try {
      await room.act(action, body);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  function move(team: Team | null, role: 'spy' | 'op') {
    const id = menuFor;
    menuFor = null;
    void act('move', { player: id, team, role });
  }

  function remove() {
    const p = menuPlayer;
    menuFor = null;
    if (p) void act(p.bot ? 'bot' : 'kick', p.bot ? { add: false, player: p.id } : { player: p.id });
  }

  function choosePlayer(p: Player) {
    hostOpen = false;
    logOpen = false;
    menuFor = p.id;
  }

  onMount(() => {
    const vv = window.visualViewport;
    const fit = () => {
      if (!stage) return;
      stage.style.setProperty('--vv-h', `${vv ? vv.height : innerHeight}px`);
      stage.style.setProperty('--vv-top', `${vv ? vv.offsetTop : 0}px`);
      wide = innerWidth >= 900;
    };
    fit();
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    addEventListener('resize', fit);
    document.documentElement.dataset.playing = '';
    return () => {
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
      removeEventListener('resize', fit);
      delete document.documentElement.dataset.playing;
    };
  });
</script>

<div class="stage" bind:this={stage}>
  <header class="top">
    <a class="home" href="/" aria-label="CDNMS"><Logo /></a>
    <span class="score t0" aria-label="{t('teamName', { team: teamName(0) })}: {t('agentsLeft', { n: game.left[0] })}">
      <span class="shape t0"></span><b class="stencil">{game.left[0]}</b>
    </span>
    <span class="score t1" aria-label="{t('teamName', { team: teamName(1) })}: {t('agentsLeft', { n: game.left[1] })}">
      <span class="shape t1"></span><b class="stencil">{game.left[1]}</b>
    </span>
    <span class="sp"></span>
    {#if isSpy}
      <span class="keyctl">
        <ewo-switch checked={!keyHidden} aria-label={t('keyOn')} onchange={(e) => (keyHidden = !e.detail.checked)}></ewo-switch>
        <span class="label">{t('keyOn')}</span>
        {#if keyHidden}
          <button
            class="peek"
            type="button"
            aria-label={t('peek')}
            title={t('peek')}
            onpointerdown={() => (peek = true)}
            onpointerup={() => (peek = false)}
            onpointerleave={() => (peek = false)}
            onpointercancel={() => (peek = false)}
            oncontextmenu={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></svg>
          </button>
        {/if}
      </span>
    {/if}
    {#if !wide}
      <button class="btn small quiet" type="button" onclick={() => (logOpen = true)}>{t('log')}{game.clues.length ? ` · ${game.clues.length}` : ''}</button>
    {/if}
    {#if isHost}
      <button class="btn small quiet" type="button" aria-label={t('hostMenu')} onclick={() => (hostOpen = true)}>⋯</button>
    {/if}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <ewo-settings-button onclick={() => (settingsOpen = true)}></ewo-settings-button>
  </header>

  <div class="table">
    <div class="cluebar"><ClueBar {room} {view} big={wide} /></div>

    <div class="boardwrap">
      <Board {game} players={view.players} {showKey} {selected} {myMark} team={myTeam} {interactive} onpick={pick} />
      <Floats {room} {view} />
      {#if toast}<p class="toast" role="status">{toast}</p>{/if}
    </div>

    <div class="under">
      {#if view.notice === 'spy-gone'}
        <p class="banner">{t('spyGone')}</p>
      {/if}
      {#if game.objection}
        <div class="banner objection" role="status">
          <span>{t('objectionBy', { name: objector?.name ?? '', word: turn.clue?.word ?? '' })}</span>
          {#if isHost}
            <span class="ask">{t('ruleAsk')}</span>
            <span class="rule">
              <button class="btn small" type="button" onclick={() => act('rule', { uphold: false })}>{t('ruleStands')}</button>
              <button class="btn small" type="button" onclick={() => act('rule', { uphold: true })}>{t('ruleFails')}</button>
            </span>
          {:else}
            <span class="ask">{t('hostDecides', { name: hostName })}</span>
          {/if}
        </div>
      {/if}
      {#if writing}
        <SpyDock {room} {view} {selected} onsent={() => (selected = [])} />
      {:else}
        <Dock {room} {view} {myMark} />
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>

    {#if wide}
      <aside class="side">
        <section class="sheet panel">
          <h2 class="label">{t('teams')}</h2>
          <Teams {view} onplayer={choosePlayer} />
        </section>
        <section class="sheet panel log">
          <h2 class="label">{t('log')}</h2>
          <Log {view} />
        </section>
      </aside>
    {/if}
  </div>
</div>

<ewo-sheet open={logOpen} label={t('log')} oncancel={() => (logOpen = false)} onclose={() => (logOpen = false)}>
  <span slot="heading">{t('log')}</span>
  {#if logOpen}
    <div class="sheetbody">
      <Teams {view} onplayer={choosePlayer} />
      <Log {view} />
    </div>
  {/if}
</ewo-sheet>

<ewo-sheet open={hostOpen} label={t('hostMenu')} oncancel={() => (hostOpen = false)} onclose={() => (hostOpen = false)}>
  <span slot="heading">{t('hostMenu')}</span>
  {#if hostOpen}
    <div class="sheetbody">
      <button class="btn block" type="button" onclick={() => ((hostOpen = false), act('pass'))}>{t('pass')}</button>
      <Teams {view} onplayer={choosePlayer} />
      <button class="btn quiet block danger" type="button" onclick={() => ((hostOpen = false), act('stop'))}>{t('stopGame')}</button>
    </div>
  {/if}
</ewo-sheet>

<PlayerMenu player={menuPlayer} playing onmove={move} onremove={remove} onclose={() => (menuFor = null)} />
<Settings open={settingsOpen} onclose={() => (settingsOpen = false)} />

<style>
  .stage {
    position: fixed;
    inset: var(--vv-top, 0px) 0 auto 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: var(--vv-h, 100dvh);
    padding: max(6px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    width: 100%;
    max-width: 1240px;
    margin: 0 auto;
  }
  .home {
    text-decoration: none;
  }
  .home :global(.logo) {
    font-size: 21px;
  }
  .score {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px 2px;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: var(--paper);
  }
  .score b {
    font-size: 20px;
    line-height: 1;
    min-width: 0.6em;
    text-align: center;
  }
  .sp {
    flex: 1;
  }
  .keyctl {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .keyctl .label {
    font-size: 10px;
  }
  @media (max-width: 520px) {
    .home,
    .keyctl .label {
      display: none;
    }
    .top {
      gap: 6px;
    }
  }
  .peek {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1.5px solid var(--ink);
    border-radius: 50%;
    background: var(--paper);
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .peek svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }

  .table {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 8px;
    width: 100%;
    max-width: 1240px;
    margin: 0 auto;
  }
  .boardwrap {
    position: relative;
    min-height: 0;
  }
  .under {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
  .toast {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 6;
    max-width: 90%;
    margin: 0;
    padding: 8px 14px 7px;
    border: 2.5px solid var(--stamp);
    border-radius: 4px;
    background: rgb(251 247 236 / 0.94);
    color: var(--stamp);
    font: 400 16px/1.25 var(--type);
    text-align: center;
    transform: translate(-50%, -50%) rotate(-4deg);
    pointer-events: none;
    animation: toast 3.6s ease both;
  }
  @keyframes toast {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(-4deg) scale(1.4);
    }
    8%,
    85% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(-4deg) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(-4deg) scale(1);
    }
  }
  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 10px;
    margin: 0;
    padding: 8px 10px;
    border: 1.5px solid var(--stamp);
    border-radius: 3px;
    background: var(--paper);
    color: var(--ink);
    font-size: 14px;
    text-align: center;
  }
  .objection .ask {
    font-weight: 700;
  }
  .rule {
    display: flex;
    gap: 8px;
  }
  .error {
    margin: 0;
    text-align: center;
  }
  .sheetbody {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 10px;
  }
  .danger {
    color: var(--bad);
  }

  @media (min-width: 900px) {
    .stage {
      padding-inline: var(--gutter);
    }
    .table {
      grid-template-columns: minmax(0, 1fr) 300px;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 12px 20px;
    }
    .cluebar,
    .boardwrap,
    .under {
      grid-column: 1;
    }
    .side {
      grid-column: 2;
      grid-row: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      overflow: auto;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
    }
    .panel h2 {
      margin: 0;
    }
    .panel.log {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
  }
</style>
