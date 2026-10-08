<!--
  The start: who you are (a face and your name), then a new game, or a game by its code.
-->
<script lang="ts">
  import { api, ApiError, CODE, type Seat } from '../lib/api';
  import type { Avatar } from '../lib/avatar';
  import { errorText, t } from '../lib/i18n.svelte';
  import { saveAvatar, savedAvatar, savedName } from '../lib/session';
  import AvatarMaker from './AvatarMaker.svelte';

  let { oncreate, onjoin }: { oncreate: (seat: Seat, name: string) => void; onjoin: (code: string) => void } = $props();

  let name = $state(savedName());
  let avatar: Avatar = $state(savedAvatar());
  let code = $state('');
  let busy = $state(false);
  let error = $state('');

  const cleanCode = $derived(code.trim().toUpperCase());

  function changeAvatar(next: Avatar) {
    avatar = next;
    saveAvatar(next);
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = errorText('name');
      return;
    }
    busy = true;
    error = '';
    try {
      oncreate(await api.create(name.trim(), avatar), name.trim());
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    } finally {
      busy = false;
    }
  }

  function join(event: SubmitEvent) {
    event.preventDefault();
    if (CODE.test(cleanCode)) onjoin(cleanCode);
  }
</script>

<div class="home">
  <form class="sheet ruled card" onsubmit={create}>
    <span class="stamp corner" aria-hidden="true">{t('secret')}</span>
    <h1 class="stencil">{t('whoAreYou')}</h1>
    <AvatarMaker {avatar} onchange={changeAvatar} />
    <label class="field">
      <span class="label">{t('yourName')}</span>
      <input class="input" bind:value={name} maxlength="16" autocomplete="nickname" placeholder={t('namePlaceholder')} />
    </label>
    <button class="btn primary block" type="submit" disabled={busy}>{t('newGame')}</button>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>

  <form class="join" onsubmit={join}>
    <span class="label">{t('joinWithCode')}</span>
    <div class="row">
      <input
        class="input code"
        bind:value={code}
        maxlength="4"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        placeholder={t('codePlaceholder')}
        aria-label={t('code')}
      />
      <button class="btn" type="submit" disabled={!CODE.test(cleanCode)}>{t('join')}</button>
    </div>
  </form>

  <details class="rules">
    <summary class="label">{t('rules')}</summary>
    <p>{t('rulesText')}</p>
  </details>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 440px;
    margin: 14px auto 0;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 6px 16px 18px;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 26px;
    line-height: 25px;
  }
  .corner {
    position: absolute;
    top: 4px;
    right: 12px;
    font-size: 11px;
    transform: rotate(8deg);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .join {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 4px;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  .code {
    flex: 1;
    min-width: 0;
    font-family: var(--ewo-mono);
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .rules {
    padding: 0 4px;
  }
  .rules summary {
    cursor: pointer;
    width: fit-content;
  }
  .rules p {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-2);
  }
</style>
