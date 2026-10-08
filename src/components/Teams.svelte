<!--
  The two teams during a game: agents still to find, the spymaster and the operatives, who's away.
  The host taps a player to seat them elsewhere (a team that lost its spymaster).
-->
<script lang="ts">
  import type { Player, View } from '../lib/api';
  import { t, teamName } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';

  let { view, onplayer }: { view: View; onplayer?: (p: Player) => void } = $props();

  const game = $derived(view.game!);
  const isHost = $derived(view.me === view.host);
  const watching = $derived(view.players.filter((p) => p.team === null));
</script>

<div class="teams">
  {#each [0, 1] as const as team (team)}
    {@const members = view.players.filter((p) => p.team === team).sort((a, b) => (a.role === 'spy' ? -1 : b.role === 'spy' ? 1 : 0))}
    <section class="team t{team}" class:turn={game.turn?.team === team}>
      <h3>
        <span class="shape t{team}"></span>
        {t('teamName', { team: teamName(team) })}
        <b class="stencil">{game.left[team]}</b>
      </h3>
      <ul>
        {#each members as p (p.id)}
          <li>
            <svelte:element
              this={isHost && p.id !== view.me ? 'button' : 'span'}
              class="player"
              class:away={!p.online}
              type={isHost && p.id !== view.me ? 'button' : undefined}
              onclick={isHost && p.id !== view.me ? () => onplayer?.(p) : undefined}
              role={isHost && p.id !== view.me ? undefined : 'presentation'}
            >
              <Avatar avatar={p.avatar} size={22} />
              <span class="name">{p.name}</span>
              {#if p.role === 'spy'}<small>{t('spy')}</small>{/if}
              {#if p.id === view.me}<small>{t('you')}</small>{/if}
              {#if p.bot}<small>{t('bot')}</small>{:else if !p.online}<small>{t('away')}</small>{/if}
            </svelte:element>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  {#if watching.length}
    <p class="watching"><span class="label">{t('watching')}</span> {watching.map((p) => p.name).join(', ')}</p>
  {/if}
</div>

<style>
  .teams {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .team {
    padding: 8px 10px;
    border: 1px solid var(--line-2);
    border-radius: 3px;
    background: var(--paper);
  }
  .team.turn.t0 {
    box-shadow: inset 4px 0 0 var(--t0);
  }
  .team.turn.t1 {
    box-shadow: inset 4px 0 0 var(--t1);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 6px;
    font: 800 15px/1 var(--stencil);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h3 b {
    margin-left: auto;
    font-size: 22px;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .player {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 30px;
    padding: 2px 4px;
    border: 0;
    border-radius: 3px;
    background: none;
    text-align: left;
    font: 600 13.5px/1.2 var(--ewo-sans);
  }
  button.player {
    cursor: pointer;
  }
  @media (hover: hover) {
    button.player:hover {
      background: var(--paper-2);
    }
  }
  .away {
    opacity: 0.55;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    flex: none;
    font: 600 9.5px/1 var(--ewo-sans);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .watching {
    margin: 0;
    font-size: 13px;
    color: var(--ink-2);
  }
</style>
