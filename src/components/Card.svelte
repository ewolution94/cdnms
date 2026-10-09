<!--
  One card on the board: index-card stock with its word in plain type, or its picture. What it shows
  depends on who's looking: revealed, it's the agent's ink (with a hat), a bystander's manila or the
  assassin's black; to a spymaster, an unrevealed card carries the key as a tint, a team's shape and
  a stripe, so it never depends on colour alone.
-->
<script lang="ts">
  import type { Card, Key, Player, Revealed } from '../lib/api';
  import { cardName, keyName, pictureSvg, pictureView } from '../lib/cards';
  import Avatar from './Avatar.svelte';

  let {
    card,
    revealed,
    keyed = null,
    selected = false,
    mine = false,
    marks = [],
    fresh = false,
    interactive = false,
    team = null,
    em,
    onpick,
  }: {
    card: Card;
    /** A word's width in em of its type, measured by the board. */
    em?: number;
    revealed: Revealed | null;
    /** The key for this card, when the viewer may see it and it's still hidden. */
    keyed?: Key | null;
    /** The spymaster has chosen it for the clue being written. */
    selected?: boolean;
    /** The viewer points at it. */
    mine?: boolean;
    /** Who points at it. */
    marks?: Player[];
    /** Just turned over: the stamp comes down. */
    fresh?: boolean;
    interactive?: boolean;
    /** The viewer's team (for the colour of their own pointer). */
    team?: 0 | 1 | null;
    onpick?: () => void;
  } = $props();

  const k = $derived(revealed?.key ?? null);
  const label = $derived(cardName(card) + (k !== null ? `, ${keyName(k)}` : keyed !== null ? `, ${keyName(keyed)}` : ''));
</script>

<button
  class="card"
  class:word={card.kind === 'word'}
  class:pic={card.kind === 'pic'}
  class:r0={k === 0}
  class:r1={k === 1}
  class:rb={k === 'b'}
  class:ra={k === 'a'}
  class:k0={k === null && keyed === 0}
  class:k1={k === null && keyed === 1}
  class:kb={k === null && keyed === 'b'}
  class:ka={k === null && keyed === 'a'}
  class:selected
  class:mine
  class:mine0={mine && team === 0}
  class:mine1={mine && team === 1}
  class:fresh
  class:interactive
  type="button"
  aria-label={label}
  aria-pressed={interactive ? selected || mine : undefined}
  aria-disabled={!interactive}
  tabindex={interactive ? 0 : -1}
  onclick={() => interactive && onpick?.()}
>
  {#if card.kind === 'word'}
    <span class="w" style="--em:{em ?? 6}">{card.text}</span>
  {:else}
    <svg class="art" viewBox={pictureView} aria-hidden="true">{@html pictureSvg(card)}</svg>
  {/if}
  {#if k === 0 || k === 1}
    <svg class="agent" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10.2" r="3.3" /><path d="M5.5 21.5c.5-4 3.2-6.4 6.5-6.4s6 2.4 6.5 6.4z" /><path d="M6.2 6.4h11.6v1.5H6.2z" /><path d="M8.8 6.6l.9-3.6h4.6l.9 3.6z" /></svg>
  {:else if k === 'a' || (k === null && keyed === 'a')}
    <span class="cross" aria-hidden="true"></span>
  {/if}
  {#if k === null && (keyed === 0 || keyed === 1)}<span class="sh t{keyed}" aria-hidden="true"></span>{/if}
  {#if selected}<span class="clip" aria-hidden="true"></span>{/if}
  {#if marks.length && k === null}
    <span class="marks" aria-hidden="true">
      {#each marks.slice(0, 3) as p (p.id)}<Avatar avatar={p.avatar} size={18} />{/each}
      {#if marks.length > 3}<b>+{marks.length - 3}</b>{/if}
    </span>
  {/if}
  {#if fresh}<span class="stampmark" aria-hidden="true"></span>{/if}
</button>

<style>
  .card {
    position: relative;
    container-type: size;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    padding: 0 3px;
    border: 1px solid var(--line-2);
    border-radius: 3px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 1px 0 rgb(80 60 10 / 0.2), 0 6px 10px -8px rgb(60 40 0 / 0.45);
    overflow: visible;
    cursor: default;
    -webkit-tap-highlight-color: transparent;
    transition:
      transform var(--ewo-dur-1) var(--ewo-ease),
      background-color 260ms ease,
      color 260ms ease;
  }
  .card.interactive {
    cursor: pointer;
  }
  @media (hover: hover) {
    .card.interactive:hover {
      transform: translateY(-1px);
    }
  }
  /* The mouse's press; a finger gets Folio's pressFeedback (main.ts). */
  @media (hover: hover) and (pointer: fine) {
    .card.interactive:active {
      transform: scale(0.97);
    }
  }
  .card:focus-visible {
    outline: 3px solid var(--t1);
    outline-offset: 2px;
  }

  /* Plain Geist as written, not the stencil in capitals: the words must read at a glance on a phone.
     One size for every word on the board, the largest at which its widest word (--word-em, from the
     board) fits: words of many sizes looked busy (the user, 2026-10-08). That size stops at 9px; a
     word that still doesn't fit there (a host's own, up to 14 letters) shrinks alone (--em, its own
     width). Board.svelte's ruler measures in this type: change both together. */
  .w {
    max-width: 100%;
    overflow: hidden;
    font: 620 min(max(calc(92cqi / var(--word-em)), 9px), calc(92cqi / var(--em)), 36px, 44cqh) / 1.1 var(--ewo-sans);
    text-transform: capitalize;
    white-space: nowrap;
  }
  .art {
    width: 100%;
    height: 100%;
    padding: 6% 4%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .art :global(*) {
    vector-effect: non-scaling-stroke;
  }
  @container (min-width: 110px) {
    .art {
      stroke-width: 2px;
    }
  }

  /* The key, for a spymaster: a tint, a stripe and the team's shape. */
  .k0 {
    background: var(--t0-soft);
    box-shadow: inset 4px 0 0 var(--t0), 0 1px 0 rgb(80 60 10 / 0.2);
  }
  .k1 {
    background: var(--t1-soft);
    box-shadow: inset 4px 0 0 var(--t1), 0 1px 0 rgb(80 60 10 / 0.2);
  }
  .kb {
    background: var(--by-soft);
  }
  .ka {
    background: var(--as);
    color: var(--as-ink);
    border-color: var(--as);
  }
  .sh {
    position: absolute;
    top: 4px;
    left: 8px;
    width: 7px;
    height: 7px;
  }
  .sh.t0 {
    border-radius: 50%;
    background: var(--t0);
  }
  .sh.t1 {
    background: var(--t1);
  }

  /* Turned over. */
  .r0,
  .r1,
  .rb,
  .ra {
    border-color: transparent;
  }
  .r0 {
    background: var(--t0);
    color: var(--t0-ink);
  }
  .r1 {
    background: var(--t1);
    color: var(--t1-ink);
  }
  .rb {
    background: var(--by);
    color: var(--by-ink);
  }
  .ra {
    background: var(--as);
    color: var(--as-ink);
  }
  .rb .w {
    opacity: 0.88;
  }
  .r0 .art,
  .r1 .art,
  .rb .art {
    opacity: 0.32;
  }
  .agent {
    position: absolute;
    left: 3px;
    bottom: 2px;
    width: min(42%, 38cqh);
    height: auto;
    fill: currentColor;
    opacity: 0.2;
    pointer-events: none;
  }
  .pic .agent {
    left: auto;
    right: 3px;
    width: min(46%, 52cqh);
    opacity: 0.85;
  }
  /* The assassin's cross, as a stamp. */
  .cross {
    position: absolute;
    top: 4px;
    right: 5px;
    width: min(14px, 26cqh);
    height: min(14px, 26cqh);
    background:
      linear-gradient(45deg, transparent 41%, var(--stamp) 41% 59%, transparent 59%),
      linear-gradient(-45deg, transparent 41%, var(--stamp) 41% 59%, transparent 59%);
  }

  /* Chosen by the spymaster: lifted, outlined, clipped. */
  .selected {
    transform: translateY(-3px);
    outline: 2px solid var(--ink);
    outline-offset: 1px;
    z-index: 1;
  }
  .clip {
    position: absolute;
    top: -7px;
    left: 50%;
    width: 9px;
    height: 17px;
    margin-left: -4.5px;
    border: 1.5px solid var(--clip);
    border-radius: 5px;
    background: linear-gradient(var(--clip), var(--clip)) 50% 3px / 1.5px 9px no-repeat;
  }

  /* Who points at it: small faces in the corner; your own pointer outlines the card. */
  .marks {
    position: absolute;
    top: -6px;
    right: -4px;
    display: flex;
    align-items: center;
    z-index: 2;
  }
  .marks :global(.av) {
    margin-left: -6px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 1.5px var(--paper);
  }
  /* On a big card the faces grow with it. */
  @container (min-width: 140px) {
    .marks {
      top: -8px;
      right: -6px;
      transform: scale(1.6);
      transform-origin: top right;
    }
  }
  .marks b {
    margin-left: 2px;
    font: 700 10px/1 var(--ewo-sans);
  }
  .mine0 {
    outline: 2.5px dashed var(--t0);
    outline-offset: 2px;
  }
  .mine1 {
    outline: 2.5px dashed var(--t1);
    outline-offset: 2px;
  }

  /* Turned over just now: the stamp comes down on it. */
  .stampmark {
    position: absolute;
    inset: 12% 18%;
    border: 3px solid currentColor;
    border-radius: 4px;
    opacity: 0;
    pointer-events: none;
    animation: stamp 620ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  @keyframes stamp {
    0% {
      opacity: 0;
      transform: scale(1.8) rotate(-14deg);
    }
    35% {
      opacity: 0.9;
      transform: scale(0.96) rotate(-6deg);
    }
    100% {
      opacity: 0;
      transform: scale(1) rotate(-6deg);
    }
  }
  .fresh {
    animation: thud 360ms ease-out both;
  }
  @keyframes thud {
    0% {
      transform: scale(1.06);
    }
    40% {
      transform: scale(0.96);
    }
    100% {
      transform: none;
    }
  }
</style>
