<!--
  The host's sheet for one player: make them a team's spymaster or operative, let them watch, or
  take them out of the game (a bot: remove it). In the lobby and during a game, when a team has lost
  its spymaster.
-->
<script lang="ts">
  import type { Player, Team } from '../lib/api';
  import { t, teamName } from '../lib/i18n.svelte';

  let {
    player,
    playing = false,
    onmove,
    onremove,
    onclose,
  }: {
    player: Player | null;
    /** During a game nobody is sent to watch from the spymaster's seat. */
    playing?: boolean;
    onmove: (team: Team | null, role: 'spy' | 'op') => void;
    onremove: () => void;
    onclose: () => void;
  } = $props();

  let shown: Player | null = $state(null);
  $effect(() => {
    if (player) shown = player;
  });
</script>

<ewo-sheet open={Boolean(player)} label={t('playerActions')} oncancel={onclose} onclose={() => ((shown = null), onclose())}>
  <span slot="heading">{shown?.name ?? t('playerActions')}</span>
  {#if shown}
    <div class="menu">
      {#each [0, 1] as const as team (team)}
        {#if !(shown.team === team && shown.role === 'spy')}
          <button class="btn block" type="button" onclick={() => onmove(team, 'spy')}><span class="shape t{team}"></span>{t('makeSpy', { team: teamName(team) })}</button>
        {/if}
        {#if !(shown.team === team && shown.role === 'op')}
          <button class="btn block" type="button" onclick={() => onmove(team, 'op')}><span class="shape t{team}"></span>{t('makeOp', { team: teamName(team) })}</button>
        {/if}
      {/each}
      {#if shown.team !== null && !shown.bot && !(playing && shown.role === 'spy')}
        <button class="btn block" type="button" onclick={() => onmove(null, 'op')}>{t('makeWatch')}</button>
      {/if}
      <button class="btn quiet block danger" type="button" onclick={onremove}>{shown.bot ? t('removeBot') : t('kick')}</button>
    </div>
  {/if}
</ewo-sheet>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 8px;
  }
  .menu .btn {
    justify-content: flex-start;
  }
  .danger {
    color: var(--bad);
  }
</style>
