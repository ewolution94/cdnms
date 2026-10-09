<!--
  The agent maker: Folio's emblem maker in the agent theme (vendor/ewo; development/plans/emblems.md),
  arrows on either side of the big agent like Kritzle's and Schätzle's, one pair per part, top to
  bottom (hat, eyes, disguise, collar, skin), and a dice for all five. The user, 2026-10-08: tabs with
  one pair lost taps, and five pairs are enough (the colour part went). Dressed as a photo clipped into
  the file: the stage is a mugshot.
-->
<script lang="ts">
  import type { Avatar as AvatarValue } from '../lib/avatar';

  let { avatar, onchange }: { avatar: AvatarValue; onchange: (next: AvatarValue) => void } = $props();
</script>

<ewo-emblem-maker class="maker" theme="agent" value={avatar} onchange={(e) => onchange(e.detail.value as AvatarValue)}></ewo-emblem-maker>

<style>
  .maker {
    gap: 14px;
    --ewo-emblem-maker-inset: 6%;
    --ewo-emblem-ink: var(--ink);
  }
  .maker::part(arrow) {
    padding: 0;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: var(--paper);
    color: var(--ink);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) {
    .maker::part(arrow):hover {
      background: #fffdf6;
    }
  }
  .maker::part(arrow):active {
    background: var(--paper-2);
  }
  .maker::part(arrow):focus-visible,
  .maker::part(dice):focus-visible {
    outline: 3px solid var(--t1);
    outline-offset: 2px;
  }
  /* The mugshot: white photo paper with a thin border, a little crooked; its margin keeps the frame
     clear of the arrows. */
  .maker::part(stage) {
    margin-inline: 4px;
    border-radius: 2px;
    background: #ffffff;
    box-shadow: 0 0 0 6px #ffffff, 0 0 0 7px var(--line), 0 12px 18px -10px rgb(60 40 0 / 0.5);
    transform: rotate(-1.5deg);
  }
  .maker::part(tag) {
    z-index: 2;
    padding: 5px 10px 4px;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: var(--paper);
    color: var(--ink);
    font: 400 13px/1 var(--type);
    letter-spacing: 0.08em;
  }
  .maker::part(legend) {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--mute);
  }
  .maker::part(dice) {
    min-height: 36px;
    padding: 0 12px;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: transparent;
    color: var(--ink);
    font: 700 14px / 1.2 var(--ewo-sans);
    -webkit-tap-highlight-color: transparent;
    transition: transform var(--ewo-dur-1) var(--ewo-ease);
  }
  /* The mouse's press; a finger gets Folio's pressFeedback (main.ts). */
  @media (hover: hover) and (pointer: fine) {
    .maker::part(dice):active {
      transform: scale(0.97);
    }
  }
</style>
