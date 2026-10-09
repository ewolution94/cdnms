<!--
  A button you hold, not tap: a ring fills while you hold it, and only a full ring acts. For
  turning a card over, where a slip of the thumb would cost the game. Works with a mouse, a finger
  and the keyboard (hold Space or Enter).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** `onhold` gets the button, so the wait for the server can show on it (src/lib/waits.ts). */
  let { ms = 650, disabled = false, onhold, children }: { ms?: number; disabled?: boolean; onhold: (button: HTMLButtonElement) => void; children: Snippet } = $props();

  let holding = $state(false);
  let button: HTMLButtonElement | undefined = $state();
  let timer = 0;

  function start() {
    if (disabled || holding) return;
    holding = true;
    timer = window.setTimeout(() => {
      holding = false;
      navigator.vibrate?.(12);
      if (button) onhold(button);
    }, ms);
  }
  function stop() {
    clearTimeout(timer);
    holding = false;
  }
</script>

<button
  bind:this={button}
  class="hold"
  class:holding
  type="button"
  {disabled}
  style="--ms:{ms}ms"
  onpointerdown={(e) => {
    if (e.button === 0) start();
  }}
  onpointerup={stop}
  onpointerleave={stop}
  onpointercancel={stop}
  oncontextmenu={(e) => e.preventDefault()}
  onkeydown={(e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      start();
    }
  }}
  onkeyup={(e) => {
    if (e.key === ' ' || e.key === 'Enter') stop();
  }}
>
  <svg class="ring" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" class="track" />
    <circle cx="12" cy="12" r="9" class="fill" pathLength="100" />
  </svg>
  <span class="text">{@render children()}</span>
</button>

<style>
  .hold {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 0 14px;
    border: 0;
    border-radius: 3px;
    background: var(--ink);
    color: var(--paper);
    text-align: left;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .hold:disabled {
    opacity: 0.45;
  }
  .hold:focus-visible {
    outline: 3px solid var(--t1);
    outline-offset: 2px;
  }
  .ring {
    flex: none;
    width: 26px;
    height: 26px;
    transform: rotate(-90deg);
    fill: none;
    stroke-width: 3;
  }
  .track {
    stroke: currentColor;
    opacity: 0.25;
  }
  .fill {
    stroke: currentColor;
    stroke-linecap: round;
    stroke-dasharray: 0 100;
  }
  .holding .fill {
    stroke-dasharray: 100 100;
    transition: stroke-dasharray var(--ms) linear;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
</style>
