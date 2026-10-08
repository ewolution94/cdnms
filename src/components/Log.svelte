<!--
  The game's log: every clue so far, who gave it, and the cards picked for it in their key's colours.
  A spymaster also sees what they meant with their own clues (everyone does at the end).
-->
<script lang="ts">
  import type { Clue, Key, View } from '../lib/api';
  import { cardName, keyName } from '../lib/cards';
  import { t } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';

  let { view, clues = view.game?.clues ?? [], meantAlways = false }: { view: View; clues?: Clue[]; meantAlways?: boolean } = $props();

  const game = $derived(view.game!);
  const byId = $derived(new Map(view.players.map((p) => [p.id, p])));
  const tagClass = (k: Key) => (k === 0 ? 't0' : k === 1 ? 't1' : k === 'b' ? 'b' : 'a');
  const number = (c: Clue) => (c.number === 'inf' ? '∞' : String(c.number));
</script>

{#if !clues.length}
  <p class="empty">{t('noClues')}</p>
{:else}
  <ol class="log">
    {#each clues as c (c.turn)}
      {@const giver = byId.get(c.by)}
      <li class="entry t{c.team}">
        <span class="head">
          {#if giver}<Avatar avatar={giver.avatar} size={22} />{/if}
          <span class="cw typed">{c.word}</span>
          <b class="stencil">{number(c)}</b>
          {#if c.objected}<small class="obj">{t(c.objected)}</small>{/if}
        </span>
        {#if c.intended}
          <span class="row">
            <span class="label">{t('meant')}</span>
            {#if c.intended.length}
              {#each c.intended as card (card)}
                <span class="tag meant" class:hit={c.picks.some((p) => p.card === card)}>{cardName(game.cards[card])}</span>
              {/each}
            {:else}
              <span class="none">{t('nothingMeant')}</span>
            {/if}
          </span>
        {/if}
        {#if c.picks.length}
          <span class="row">
            {#if c.intended || meantAlways}<span class="label">{t('picked')}</span>{/if}
            {#each c.picks as pick (pick.card)}
              <span class="tag {tagClass(pick.key)}" title={keyName(pick.key)}>{cardName(game.cards[pick.card])}</span>
            {/each}
          </span>
        {/if}
      </li>
    {/each}
  </ol>
{/if}

<style>
  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--mute);
  }
  .log {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 0 8px 10px;
    border-top: 1px solid var(--rule-blue);
    border-left: 3px solid var(--t0);
  }
  .entry:first-child {
    border-top: 0;
  }
  .entry.t1 {
    border-left-color: var(--t1);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .cw {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .head b {
    font-size: 18px;
  }
  .obj {
    margin-left: auto;
    font-size: 10.5px;
    color: var(--stamp);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .row .label {
    width: 56px;
    font-size: 9.5px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 2px;
    font: 700 11.5px/1.25 var(--ewo-sans);
  }
  .tag.t0 {
    background: var(--t0);
    color: var(--t0-ink);
  }
  .tag.t1 {
    background: var(--t1);
    color: var(--t1-ink);
  }
  .tag.b {
    background: var(--by);
    color: var(--by-ink);
  }
  .tag.a {
    background: var(--as);
    color: var(--as-ink);
  }
  .tag.meant {
    border: 1px dashed var(--ink-2);
    background: transparent;
    color: var(--ink);
  }
  .tag.meant.hit {
    border-style: solid;
  }
  .none {
    font-size: 11.5px;
    color: var(--mute);
  }
</style>
