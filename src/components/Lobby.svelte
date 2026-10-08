<!--
  The lobby: the room's code, link and QR code; the two teams with their spymaster seat and their
  operatives; who's watching; and the host's settings. A setting answers the tap at once and the
  server's echo takes over once it agrees (learnings/ui-preferences.md → "A control answers the tap").
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError, type Config, type Pack, type Player, type Settings, type Team, type View } from '../lib/api';
  import type { Avatar as AvatarValue } from '../lib/avatar';
  import { errorText, t, teamName, type Key } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { saveAvatar, saveCustom, savedCustom } from '../lib/session';
  import Avatar from './Avatar.svelte';
  import AvatarMaker from './AvatarMaker.svelte';
  import PlayerMenu from './PlayerMenu.svelte';
  import Qr from './Qr.svelte';

  let { room, view, config }: { room: Room; view: View; config: Config | null } = $props();

  const PACKS: Pack[] = $derived(config?.packs ?? ['classic', 'everyday', 'nature', 'places', 'office', 'culture']);
  const CLUE_SECONDS = $derived(config?.clueSeconds ?? [30, 60, 90, 120, 180]);
  const GUESS_SECONDS = $derived(config?.guessSeconds ?? [30, 60, 90, 120, 180, 240]);
  const BONUS = $derived(config?.bonusSeconds ?? [0, 30, 60]);

  let pending: Partial<Settings> = $state({});
  let sending = false;
  let error = $state('');
  let copied = $state(false);
  let qrOpen = $state(false);
  let customText = $state('');
  let customTimer = 0;
  /** The player whose seat the host is changing (a sheet), or null. */
  let menuFor: string | null = $state(null);
  let avatarOpen = $state(false);
  let avatarShown = $state(false);
  let myAvatar: AvatarValue | null = $state(null);
  $effect(() => {
    if (avatarOpen) avatarShown = true;
  });

  const isHost = $derived(view.me === view.host);
  const settings: Settings = $derived({ ...view.settings, ...pending });
  const me = $derived(view.players.find((p) => p.id === view.me));
  const hostName = $derived(view.players.find((p) => p.id === view.host)?.name ?? '');
  const link = $derived(`${location.origin}/${view.code}`);
  const teams = $derived(([0, 1] as const).map((team) => ({
    team,
    spy: view.players.find((p) => p.team === team && p.role === 'spy') ?? null,
    ops: view.players.filter((p) => p.team === team && p.role === 'op'),
  })));
  const watching = $derived(view.players.filter((p) => p.team === null));
  const menuPlayer = $derived(view.players.find((p) => p.id === menuFor) ?? null);
  /** Why the game can't start yet, in words; empty when it can. */
  const blocker = $derived(
    teams.find((x) => !x.spy)
      ? t('needSpy', { team: teamName(teams.find((x) => !x.spy)!.team) })
      : teams.find((x) => !x.ops.length)
        ? t('needOp', { team: teamName(teams.find((x) => !x.ops.length)!.team) })
        : '',
  );
  const words = $derived(settings.cards !== 'pictures');

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // The server agrees: its value takes over.
  $effect(() => {
    const server = view.settings;
    const left = Object.fromEntries(Object.entries(pending).filter(([k, v]) => !same(server[k as keyof Settings], v)));
    if (Object.keys(left).length !== Object.keys(pending).length) pending = left;
  });

  function change(patch: Partial<Settings>) {
    if (!isHost) return;
    pending = { ...pending, ...patch };
    void flush();
  }

  async function flush() {
    if (sending) return;
    const body = { ...pending };
    if (!Object.keys(body).length) return;
    sending = true;
    error = '';
    try {
      await room.act('settings', body);
    } catch (e) {
      pending = {};
      error = errorText(e instanceof ApiError ? e.code : 'other');
    } finally {
      sending = false;
    }
    if (Object.keys(pending).length && !same(pending, body)) void flush();
  }

  function togglePack(pack: string) {
    const packs = settings.packs.includes(pack as never) ? settings.packs.filter((p) => p !== pack) : [...settings.packs, pack];
    change({ packs: PACKS.filter((p) => packs.includes(p as never)) as Settings['packs'] });
  }

  function typeCustom(text: string) {
    customText = text;
    saveCustom(text);
    clearTimeout(customTimer);
    customTimer = window.setTimeout(() => change({ custom: text }), 700);
  }

  onMount(() => {
    // The host's own words from last time come along.
    customText = view.settings.custom;
    const saved = savedCustom();
    if (isHost && !view.settings.custom && saved) {
      customText = saved;
      change({ custom: saved });
    }
  });

  async function act(action: string, body?: unknown) {
    error = '';
    try {
      await room.act(action, body);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // The link is on the page to select by hand.
    }
  }

  /** A tap on a player: your own row opens your face; the host's tap on someone else, their seat. */
  function tapPlayer(p: Player) {
    if (p.id === view.me) {
      myAvatar = p.avatar;
      avatarOpen = true;
    } else if (isHost) menuFor = p.id;
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

  function changeAvatar(next: AvatarValue) {
    myAvatar = next;
    saveAvatar(next);
    void act('avatar', { avatar: next });
  }

  const seg = (key: Key) => t(key);
</script>

{#snippet playerRow(p: Player, team: Team | null)}
  {@const tappable = p.id === view.me || isHost}
  <svelte:element
    this={tappable ? 'button' : 'div'}
    class="player"
    class:me={p.id === view.me}
    class:away={!p.online}
    type={tappable ? 'button' : undefined}
    onclick={tappable ? () => tapPlayer(p) : undefined}
    role={tappable ? undefined : 'listitem'}
  >
    <Avatar avatar={p.avatar} size={26} />
    <span class="name">{p.name}</span>
    {#if p.id === view.me}<small>{t('you')}</small>{/if}
    {#if p.id === view.host}<small>{t('host')}</small>{/if}
    {#if p.bot}<small>{t('bot')}</small>{:else if !p.online}<small>{t('away')}</small>{/if}
    {#if team !== null && p.role === 'spy'}<span class="clip" aria-hidden="true"></span>{/if}
  </svelte:element>
{/snippet}

<div class="lobby">
  <div class="side">
    <section class="sheet ruled roomcard">
      <span class="label head">{t('room')}</span>
      <span class="stamp secret" aria-hidden="true">{t('secret')}</span>
      <div class="coderow">
        <span class="code">{view.code}</span>
        <div class="links">
          <button class="btn small" type="button" onclick={copy}>{copied ? t('copied') : t('copyLink')}</button>
          <button class="btn small" type="button" aria-expanded={qrOpen} onclick={() => (qrOpen = !qrOpen)}>{t('showQr')}</button>
        </div>
      </div>
      <span class="url">{link}</span>
      {#if qrOpen}<div class="qr"><Qr url={link} /></div>{/if}
      <a class="screen" href="/{view.code}/screen" target="_blank" rel="noopener">{t('bigScreen')} ↗</a>
      <span class="hint">{t('bigScreenHint')}</span>
    </section>

    <div class="teams">
      {#each teams as { team, spy, ops } (team)}
        <section class="sheet team t{team}">
          <h2><span class="shape t{team}"></span>{t('teamName', { team: teamName(team) })}</h2>
          <span class="label">{t('spy')}</span>
          {#if spy}
            {@render playerRow(spy, team)}
          {:else}
            <button class="seat" type="button" onclick={() => act('seat', { team, role: 'spy' })}>{t('becomeSpy')}</button>
          {/if}
          <span class="label">{t('ops')}</span>
          <div class="ops" role="list">
            {#each ops as p (p.id)}{@render playerRow(p, team)}{/each}
          </div>
          {#if !(me?.team === team && me?.role === 'op')}
            <button class="seat" type="button" onclick={() => act('seat', { team, role: 'op' })}>{t('joinTeam')}</button>
          {/if}
        </section>
      {/each}
    </div>

    <div class="watching">
      <span class="label">{t('watching')}</span>
      {#each watching as p (p.id)}{@render playerRow(p, null)}{/each}
      {#if me?.team !== null}
        <button class="btn quiet small" type="button" onclick={() => act('seat', { team: null })}>{t('watch')}</button>
      {/if}
    </div>

    {#if isHost}
      <div class="hostrow">
        <button class="btn small" type="button" onclick={() => act('shuffle')}>{t('shuffle')}</button>
        <button class="btn small" type="button" onclick={() => act('bot', { add: true })}>{t('addBot')}</button>
      </div>
    {/if}
  </div>

  <section class="sheet setup" aria-label={t('settings')}>
    <div class="row">
      <span class="label">{t('cards')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.cards} label={t('cards')} onchange={(e) => change({ cards: e.detail.value as Settings['cards'] })}>
          <option value="words">{t('cards_words')}</option>
          <option value="pictures">{t('cards_pictures')}</option>
          <option value="mixed">{t('cards_mixed')}</option>
        </ewo-segmented>
      {:else}
        <b>{seg(`cards_${settings.cards}` as Key)}</b>
      {/if}
      <span class="hint">{seg(`cardsHint_${settings.cards}` as Key)}</span>
    </div>

    {#if words}
      <div class="row">
        <span class="label">{t('wordLang')}</span>
        {#if isHost}
          <ewo-segmented stretch value={settings.lang} label={t('wordLang')} onchange={(e) => change({ lang: e.detail.value as Settings['lang'] })}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </ewo-segmented>
        {:else}
          <b>{settings.lang === 'de' ? 'Deutsch' : 'English'}</b>
        {/if}
      </div>

      <div class="row">
        <span class="label">{t('packs')}</span>
        <div class="chips">
          {#each PACKS as pack (pack)}
            <button
              class="chip"
              type="button"
              aria-pressed={settings.packs.includes(pack)}
              disabled={!isHost}
              onclick={() => togglePack(pack)}>{seg(`pack_${pack}` as Key)}</button
            >
          {/each}
        </div>
      </div>

      {#if isHost}
        <details class="custom" open={Boolean(settings.custom)}>
          <summary class="label">{t('customWords')}{settings.customCount ? ` (${settings.customCount})` : ''}</summary>
          <textarea class="input" value={customText} placeholder={t('customHint')} oninput={(e) => typeCustom(e.currentTarget.value)} aria-label={t('customWords')}></textarea>
          <ewo-segmented stretch value={settings.mix} label={t('mix')} onchange={(e) => change({ mix: e.detail.value as Settings['mix'] })}>
            <option value="none">{t('mix_none')}</option>
            <option value="few">{t('mix_few')}</option>
            <option value="half">{t('mix_half')}</option>
            <option value="only">{t('mix_only')}</option>
          </ewo-segmented>
        </details>
      {:else if settings.customCount && settings.mix !== 'none'}
        <div class="row"><span class="label">{t('customWords')}</span><b>{t('customCount', { n: settings.customCount })} · {seg(`mix_${settings.mix}` as Key)}</b></div>
      {/if}
    {/if}

    <div class="row">
      <span class="label">{t('clock')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.clock} label={t('clock')} onchange={(e) => change({ clock: e.detail.value as Settings['clock'] })}>
          <option value="off">{t('clock_off')}</option>
          <option value="quick">{t('clock_quick')}</option>
          <option value="custom">{t('clock_custom')}</option>
        </ewo-segmented>
      {:else}
        <b>{seg(`clock_${settings.clock}` as Key)}</b>
      {/if}
      {#if settings.clock === 'quick'}<span class="hint">{t('clockHint_quick')}</span>{/if}
    </div>
    {#if settings.clock === 'custom'}
      {#each [['clueTime', 'clueSeconds', CLUE_SECONDS], ['guessTime', 'guessSeconds', GUESS_SECONDS], ['firstBonus', 'firstBonus', BONUS]] as const as [label, field, choices] (field)}
        <div class="row sub">
          <span class="label">{t(label)}</span>
          {#if isHost}
            <ewo-segmented stretch value={String(settings[field])} label={t(label)} onchange={(e) => change({ [field]: Number(e.detail.value) })}>
              {#each choices as n (n)}<option value={String(n)}>{field === 'firstBonus' ? `+${n}` : n} s</option>{/each}
            </ewo-segmented>
          {:else}
            <b>{t('seconds', { n: settings[field] })}</b>
          {/if}
        </div>
      {/each}
    {/if}

    <div class="row">
      <span class="label">{t('checks')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.checks} label={t('checks')} onchange={(e) => change({ checks: e.detail.value as Settings['checks'] })}>
          <option value="strict">{t('checks_strict')}</option>
          <option value="relaxed">{t('checks_relaxed')}</option>
        </ewo-segmented>
      {:else}
        <b>{seg(`checks_${settings.checks}` as Key)}</b>
      {/if}
      {#if settings.checks === 'strict' && words}<span class="hint">{t('checksHint')}</span>{/if}
    </div>

    <div class="row">
      <span class="label">{t('agree')}</span>
      {#if isHost}
        <ewo-segmented stretch value={String(settings.agree)} label={t('agree')} onchange={(e) => change({ agree: Number(e.detail.value) })}>
          <option value="1">{t('agree_1')}</option>
          <option value="2">{t('agree_2')}</option>
        </ewo-segmented>
      {:else}
        <b>{seg(`agree_${settings.agree}` as Key)}</b>
      {/if}
    </div>

    <div class="row switch">
      <span class="text"><b>{t('objections')}</b><span class="hint">{t('objectionsHint')}</span></span>
      <ewo-switch checked={settings.objections} disabled={!isHost} aria-label={t('objections')} onchange={(e) => change({ objections: e.detail.checked })}></ewo-switch>
    </div>
  </section>

  <div class="go">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if isHost}
      {#if blocker}<p class="hint center">{blocker}</p>{/if}
      <button class="btn primary block" type="button" disabled={Boolean(blocker)} onclick={() => act('start')}>{t('start')}</button>
    {:else}
      <p class="hint center">{t('waitHost', { name: hostName })}</p>
    {/if}
  </div>
</div>

<PlayerMenu player={menuPlayer} onmove={move} onremove={remove} onclose={() => (menuFor = null)} />

<ewo-sheet open={avatarOpen} label={t('changeAvatar')} oncancel={() => (avatarOpen = false)} onclose={() => ((avatarShown = false), (avatarOpen = false))}>
  <span slot="heading">{t('changeAvatar')}</span>
  {#if avatarShown && myAvatar}
    <div class="menu">
      <AvatarMaker avatar={myAvatar} onchange={changeAvatar} />
      <button class="btn primary block" type="button" onclick={() => (avatarOpen = false)}>{t('done')}</button>
    </div>
  {/if}
</ewo-sheet>

<style>
  .lobby {
    display: grid;
    gap: 16px;
    max-width: 980px;
    margin: 8px auto 0;
  }
  @media (min-width: 900px) {
    .lobby {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      align-items: start;
      gap: 24px;
    }
    .go {
      grid-column: 1 / -1;
      max-width: 420px;
      justify-self: center;
      width: 100%;
    }
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  .roomcard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 6px 14px 14px;
  }
  .head {
    line-height: 24px;
  }
  .secret {
    position: absolute;
    top: 6px;
    right: 12px;
    font-size: 11px;
  }
  .coderow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 4px;
  }
  .code {
    font: 600 34px/1 var(--ewo-mono);
    letter-spacing: 0.2em;
  }
  .links {
    display: flex;
    gap: 8px;
  }
  .url {
    font: 500 12px/1.3 var(--ewo-mono);
    color: var(--mute);
    overflow-wrap: anywhere;
    user-select: all;
  }
  .qr {
    width: min(220px, 70%);
    margin: 4px auto;
  }
  .screen {
    width: fit-content;
    font-weight: 700;
    font-size: 14px;
  }
  .hint {
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--mute);
  }
  .center {
    text-align: center;
    margin: 0;
  }

  .teams {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .team {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 0 10px 10px;
    overflow: hidden;
  }
  .team h2 {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 -10px 4px;
    padding: 9px 10px 8px;
    font: 800 17px/1 var(--stencil);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--t0-ink);
  }
  .team.t0 h2 {
    background: var(--t0);
  }
  .team.t1 h2 {
    background: var(--t1);
  }
  .team h2 .shape {
    background: currentColor;
  }
  .ops {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .player {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 36px;
    min-width: 0;
    padding: 4px 6px 4px 4px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    text-align: left;
    font: 600 14px/1.2 var(--ewo-sans);
    -webkit-tap-highlight-color: transparent;
  }
  button.player {
    cursor: pointer;
  }
  @media (hover: hover) {
    button.player:hover {
      border-color: var(--line-2);
      background: #fffdf6;
    }
  }
  .player.me {
    border-color: var(--line);
    background: #fffdf6;
  }
  .player.away {
    opacity: 0.6;
  }
  .player .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player small {
    flex: none;
    font: 600 10px/1 var(--ewo-sans);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  /* The spymaster's seat carries a paper clip. */
  .clip {
    position: absolute;
    top: -6px;
    left: 14px;
    width: 9px;
    height: 16px;
    border: 1.5px solid var(--clip);
    border-radius: 5px;
  }
  .seat {
    min-height: 36px;
    border: 1px dashed var(--line);
    border-radius: 3px;
    background: transparent;
    color: var(--ink-2);
    font: 600 13px/1 var(--ewo-sans);
  }
  @media (hover: hover) {
    .seat:hover {
      border-style: solid;
      background: #fffdf6;
    }
  }

  .watching {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 0 4px;
  }
  .hostrow {
    display: flex;
    gap: 8px;
    padding: 0 4px;
  }

  .setup {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    padding: 14px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .row.sub {
    padding-left: 12px;
    border-left: 2px solid var(--line-2);
  }
  .row b {
    font-size: 15px;
  }
  .row.switch {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .row.switch .text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .custom {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .custom summary {
    cursor: pointer;
    width: fit-content;
    margin-bottom: 8px;
  }
  .custom textarea {
    margin-bottom: 8px;
  }

  .go {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 8px;
  }
</style>
