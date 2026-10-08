<!--
  Arriving at a room's link without a seat: who you are, then into the game.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError, type Seat } from '../lib/api';
  import type { Avatar } from '../lib/avatar';
  import { errorText, t } from '../lib/i18n.svelte';
  import { saveAvatar, savedAvatar, savedName } from '../lib/session';
  import AvatarMaker from './AvatarMaker.svelte';

  let { code, onjoin, onback }: { code: string; onjoin: (seat: Seat, name: string) => void; onback: () => void } = $props();

  let name = $state(savedName());
  let avatar: Avatar = $state(savedAvatar());
  let busy = $state(false);
  let error = $state('');
  let missing = $state(false);

  onMount(() => {
    api.info(code).then(
      (info) => {
        if (info.full) error = errorText('room-full');
      },
      (e) => {
        if (e instanceof ApiError && e.code === 'no-room') missing = true;
      },
    );
  });

  function changeAvatar(next: Avatar) {
    avatar = next;
    saveAvatar(next);
  }

  async function join(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = errorText('name');
      return;
    }
    busy = true;
    error = '';
    try {
      onjoin(await api.join(code, name.trim(), avatar), name.trim());
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    } finally {
      busy = false;
    }
  }
</script>

<div class="join">
  {#if missing}
    <div class="sheet gone">
      <p>{errorText('no-room')}</p>
      <button class="btn" type="button" onclick={onback}>{t('home')}</button>
    </div>
  {:else}
    <form class="sheet ruled card" onsubmit={join}>
      <span class="file"><span class="label">{t('room')}</span> <b>{code}</b></span>
      <h1 class="stencil">{t('whoAreYou')}</h1>
      <AvatarMaker {avatar} onchange={changeAvatar} />
      <label class="field">
        <span class="label">{t('yourName')}</span>
        <input class="input" bind:value={name} maxlength="16" autocomplete="nickname" placeholder={t('namePlaceholder')} />
      </label>
      <button class="btn primary block" type="submit" disabled={busy}>{t('play')}</button>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
    <button class="btn quiet back" type="button" onclick={onback}>{t('back')}</button>
  {/if}
</div>

<style>
  .join {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  .file {
    position: absolute;
    top: 7px;
    right: 14px;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .file b {
    font: 600 14px/1 var(--ewo-mono);
    letter-spacing: 0.16em;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 26px;
    line-height: 25px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .back {
    align-self: center;
  }
  .gone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 28px 18px;
    text-align: center;
  }
</style>
