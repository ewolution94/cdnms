<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n.svelte';
  import Logo from './Logo.svelte';
  import Settings from './Settings.svelte';

  let { code }: { code: string | null } = $props();

  let scrolled = $state(false);
  let settingsOpen = $state(false);
  let button: HTMLElement | undefined = $state();

  function closeSettings() {
    settingsOpen = false;
    // Focus goes back where it came from.
    button?.focus();
  }
  onMount(() => {
    const check = () => (scrolled = scrollY > 8);
    check();
    addEventListener('scroll', check, { passive: true });
    return () => removeEventListener('scroll', check);
  });
</script>

<header class="bar" class:scrolled>
  <a class="home" href="/" aria-label="CDNMS"><Logo /></a>
  <div class="end">
    {#if code}
      <span class="code" aria-label="{t('code')} {code}">{code}</span>
    {/if}
    <!-- A real <button> sits inside the element: Enter and Space reach this handler as a click. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <ewo-settings-button bind:this={button} onclick={() => (settingsOpen = true)}></ewo-settings-button>
  </div>
</header>

<Settings open={settingsOpen} onclose={closeSettings} />

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: var(--bar-h);
    padding: 0 var(--gutter);
    background: color-mix(in oklab, var(--manila) 94%, transparent);
    border-bottom: 1px solid transparent;
  }
  .bar.scrolled {
    border-bottom-color: rgb(34 32 28 / 0.16);
  }
  .home {
    text-decoration: none;
  }
  .end {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .code {
    padding: 5px 9px 4px;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: var(--paper);
    font: 600 13px/1 var(--ewo-mono);
    letter-spacing: 0.18em;
  }
</style>
