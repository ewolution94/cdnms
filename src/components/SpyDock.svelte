<!--
  The spymaster's desk: the clue word, checked as it's typed (the server's own rules, server/clue.mjs),
  and the number, which follows the cards chosen on the board until it's set by hand. Senden types
  the clue out big and gives a few seconds to take it back before it goes.
-->
<script lang="ts">
  import { clueProblem } from '../../server/clue.mjs';
  import { ApiError, type ClueNumber, type View } from '../lib/api';
  import { cardName } from '../lib/cards';
  import { errorText, t } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';

  let { room, view, selected, onsent }: { room: Room; view: View; selected: number[]; onsent: () => void } = $props();

  const UNDO_MS = 3000;

  let word = $state('');
  let number = $state<ClueNumber>(1);
  /** Set by hand: the chosen cards no longer move it. */
  let touched = $state(false);
  let error = $state('');
  let busy = $state(false);
  /** Counting down to sending: the clue is shown big, with a way back. */
  let going = $state(false);
  let timer = 0;

  const game = $derived(view.game!);
  const open = $derived(game.cards.flatMap((c, i) => (c.kind === 'word' && !game.revealed[i] ? [{ word: c.text }] : [])));
  const problem = $derived(word.trim() ? clueProblem(word, open, { strict: view.settings.checks === 'strict' }) : null);
  const problemText = $derived(
    !problem
      ? ''
      : problem.code === 'clue-board' && problem.word
        ? t('clueBoardWord', { word: problem.word })
        : problem.code === 'clue-part' && problem.word
          ? t('cluePartWord', { word: problem.word })
          : errorText(problem.code),
  );
  const chosen = $derived(selected.map((i) => cardName(game.cards[i])));
  const shown = $derived(number === 'inf' ? '∞' : String(number));

  $effect(() => {
    const n = selected.length;
    if (!touched) number = Math.min(9, Math.max(1, n)) as ClueNumber;
  });

  function step(delta: number) {
    touched = true;
    if (number === 'inf') number = delta < 0 ? 9 : 'inf';
    else number = Math.min(9, Math.max(0, number + delta)) as ClueNumber;
  }

  function infinity() {
    touched = true;
    number = number === 'inf' ? (Math.min(9, Math.max(1, selected.length)) as ClueNumber) : 'inf';
  }

  function send(event?: Event) {
    event?.preventDefault();
    error = '';
    if (!word.trim()) {
      error = errorText('clue-empty');
      return;
    }
    if (problem || busy) return;
    going = true;
    timer = window.setTimeout(submit, UNDO_MS);
  }

  function takeBack() {
    clearTimeout(timer);
    going = false;
  }

  async function submit() {
    busy = true;
    try {
      await room.act('clue', { word: word.trim(), number, cards: selected });
      word = '';
      touched = false;
      onsent();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const w = typeof err?.detail.word === 'string' ? err.detail.word : '';
      error = err?.code === 'clue-board' && w ? t('clueBoardWord', { word: w }) : err?.code === 'clue-part' && w ? t('cluePartWord', { word: w }) : errorText(err?.code ?? 'other');
    } finally {
      busy = false;
      going = false;
    }
  }

  $effect(() => () => clearTimeout(timer));
</script>

<form class="dock sheet" onsubmit={send}>
  {#if going}
    <div class="going" role="status">
      <span class="label">{t('sendingIn')}</span>
      <span class="big"><span class="typed">{word.trim()}</span> <b class="stencil">{shown}</b></span>
      <span class="bar" style="--ms:{UNDO_MS}ms"></span>
      <button class="btn block" type="button" onclick={takeBack} disabled={busy}>{t('takeBack')}</button>
    </div>
  {:else}
    <div class="field">
      <input
        class="input clue typed"
        bind:value={word}
        maxlength="24"
        placeholder={t('cluePlaceholder')}
        aria-label={t('yourClue')}
        aria-invalid={Boolean(problem)}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="send"
      />
      {#if word.trim()}
        <span class="check" class:bad={problem} aria-live="polite">{problem ? problemText : `✓ ${t('clueOk')}`}</span>
      {/if}
    </div>
    <div class="numrow">
      <span class="label">{t('clueFor')}</span>
      <button class="step" type="button" aria-label="−1" onclick={() => step(-1)}>−</button>
      <span class="num stencil" aria-live="polite">{shown}</span>
      <button class="step" type="button" aria-label="+1" onclick={() => step(1)}>+</button>
      <button class="step inf" type="button" aria-pressed={number === 'inf'} aria-label="∞" onclick={infinity}>∞</button>
      <button class="btn primary send" type="submit" disabled={busy || Boolean(problem) || !word.trim()}>{t('send')}</button>
    </div>
    <p class="hint">
      {#if chosen.length}
        {chosen.length === 1 ? t('chosenOne') : t('chosen', { n: chosen.length })}: {chosen.join(' · ')}
      {:else}
        {t('pickHint')}
      {/if}
    </p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</form>

<style>
  .dock {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }
  .field {
    position: relative;
  }
  .clue {
    padding-right: 120px;
    font-size: 20px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .clue::placeholder {
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--ewo-sans);
    font-size: 16px;
  }
  .check {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    max-width: 52%;
    font: 700 12px/1.2 var(--ewo-sans);
    color: var(--good);
    text-align: right;
  }
  .check.bad {
    color: var(--bad);
  }
  .numrow {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .step {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: transparent;
    font: 700 20px/1 var(--ewo-sans);
    -webkit-tap-highlight-color: transparent;
  }
  .step:active {
    transform: scale(0.95);
  }
  .step.inf[aria-pressed='true'] {
    background: var(--ink);
    color: var(--paper);
  }
  .num {
    min-width: 34px;
    text-align: center;
    font-size: 30px;
    line-height: 1;
  }
  .send {
    flex: 1;
    min-height: 42px;
  }
  .hint {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.35;
    color: var(--mute);
  }
  .error {
    margin: 0;
  }
  .going {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .big {
    display: flex;
    align-items: baseline;
    gap: 12px;
    font-size: 30px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .big b {
    font-size: 36px;
  }
  .bar {
    width: 100%;
    height: 3px;
    background: var(--ink);
    transform-origin: left;
    animation: drain var(--ms) linear both;
  }
  @keyframes drain {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
</style>
