<!--
  The big screen (/<code>/screen): for a projector, or the window the host shares on a call. It plays
  no part, so it never sees the key before the end: the lobby with the link and QR code, the board
  as the operatives see it with the clue above and the teams and log beside, and the end with the
  whole key. Fits 1280 × 720 to 1920 × 1080 without scrolling.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t, teamName } from '../lib/i18n.svelte';
  import { Room } from '../lib/room.svelte';
  import { loadCensus } from '../lib/census';
  import Avatar from './Avatar.svelte';
  import Board from './Board.svelte';
  import ClueBar from './ClueBar.svelte';
  import Floats from './Floats.svelte';
  import Log from './Log.svelte';
  import Logo from './Logo.svelte';
  import Qr from './Qr.svelte';
  import Teams from './Teams.svelte';

  let { code }: { code: string } = $props();

  // The page remounts for another code ({#key} in App.svelte), so the first one is the one.
  // svelte-ignore state_referenced_locally
  const room = new Room(code);
  const view = $derived(room.view);
  const link = $derived(`${location.origin}/${code}`);

  onMount(() => {
    room.connect();
    loadCensus();
    document.documentElement.dataset.screen = '';
    return () => {
      room.close();
      delete document.documentElement.dataset.screen;
    };
  });
</script>

<div class="screen">
  <header class="top">
    <Logo />
    <span class="code">{code}</span>
    {#if view?.game}
      <span class="scores">
        <span class="score"><span class="shape t0"></span>{teamName(0)} <b class="stencil">{view.game.left[0]}</b></span>
        <span class="score"><b class="stencil">{view.game.left[1]}</b> {teamName(1)} <span class="shape t1"></span></span>
      </span>
    {/if}
  </header>

  {#if !view}
    <p class="wait label">{t('reconnecting')}</p>
  {:else if view.phase === 'gone'}
    <p class="wait stencil">{t('gone')}</p>
  {:else if view.phase === 'lobby' || !view.game}
    <div class="lobby">
      <section class="sheet ruled join">
        <span class="label">{t('screenJoin')}</span>
        <span class="url">{link.replace(/^https?:\/\//, '')}</span>
        <div class="qr"><Qr url={link} /></div>
        <span class="stamp" aria-hidden="true">{t('secret')}</span>
      </section>
      <div class="teams">
        {#each [0, 1] as const as team (team)}
          <section class="sheet team t{team}">
            <h2><span class="shape t{team}"></span>{t('teamName', { team: teamName(team) })}</h2>
            <ul>
              {#each view.players.filter((p) => p.team === team).sort((a, b) => (a.role === 'spy' ? -1 : b.role === 'spy' ? 1 : 0)) as p (p.id)}
                <li><Avatar avatar={p.avatar} size={40} /><span>{p.name}</span>{#if p.role === 'spy'}<small>{t('spy')}</small>{/if}</li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    </div>
  {:else}
    <div class="play" class:over={view.phase === 'final'}>
      <div class="main">
        {#if view.phase === 'play' && view.game.turn}
          <ClueBar {room} {view} big />
        {:else if view.game.winner !== null}
          <div class="sheet verdict"><span class="shape t{view.game.winner}"></span><b class="stencil">{t('wins', { team: teamName(view.game.winner) })}</b><span class="stamp">{t('solved')}</span></div>
        {/if}
        <div class="boardwrap">
          <Board game={view.game} players={view.players} showKey={view.phase === 'final'} />
          <Floats {room} view={view} />
        </div>
      </div>
      <aside class="side">
        <section class="sheet panel"><Teams {view} /></section>
        <section class="sheet panel log">
          <h2 class="label">{view.phase === 'final' ? t('whatMeant') : t('log')}</h2>
          <Log {view} meantAlways={view.phase === 'final'} />
        </section>
      </aside>
    </div>
  {/if}
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100dvh;
    padding: 18px 28px 22px;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .top :global(.logo) {
    font-size: 34px;
  }
  .code {
    padding: 6px 12px 5px;
    border: 1px solid var(--line);
    background: var(--paper);
    font: 600 22px/1 var(--ewo-mono);
    letter-spacing: 0.2em;
  }
  .scores {
    display: flex;
    gap: 12px;
    margin-left: auto;
  }
  .score {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid var(--line);
    background: var(--paper);
    font: 800 20px/1 var(--stencil);
    text-transform: uppercase;
  }
  .score b {
    font-size: 30px;
  }
  .wait {
    margin: auto;
    font-size: 28px;
  }
  .lobby {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 28px;
    align-items: center;
  }
  .join {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 8px 28px 28px;
  }
  .join .label {
    align-self: flex-start;
    line-height: 24px;
  }
  .url {
    font: 600 clamp(20px, 2.2vw, 32px)/1.2 var(--ewo-mono);
  }
  .qr {
    width: min(34vh, 320px);
  }
  .join .stamp {
    position: absolute;
    top: 8px;
    right: 14px;
  }
  .teams {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .team {
    padding: 0 16px 16px;
    overflow: hidden;
  }
  .team h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 -16px 12px;
    padding: 12px 16px;
    color: var(--t0-ink);
    font: 800 26px/1 var(--stencil);
    text-transform: uppercase;
  }
  .team.t0 h2 {
    background: var(--t0);
  }
  .team.t1 h2 {
    background: var(--t1);
  }
  .team h2 .shape {
    width: 14px;
    height: 14px;
    background: currentColor;
  }
  .team ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .team li {
    display: flex;
    align-items: center;
    gap: 12px;
    font: 600 22px/1.2 var(--ewo-sans);
  }
  .team small {
    font: 600 13px/1 var(--ewo-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .play {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(280px, 24vw, 380px);
    gap: 22px;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }
  .boardwrap {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .verdict {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
  }
  .verdict b {
    font-size: 40px;
  }
  .verdict .shape {
    width: 20px;
    height: 20px;
  }
  .verdict .stamp {
    margin-left: auto;
    font-size: 20px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }
  .panel {
    padding: 12px 14px;
  }
  /* Read from across the room: the teams and the log a size up. */
  .side :global(.player) {
    font-size: 17px;
  }
  .side :global(h3) {
    font-size: 19px;
  }
  .side :global(.cw) {
    font-size: 20px;
  }
  .side :global(.tag) {
    font-size: 14px;
  }
  .panel.log {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .panel.log h2 {
    margin: 0;
  }
</style>
