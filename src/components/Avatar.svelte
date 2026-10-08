<!--
  A player's agent from their six numbers, drawn by Folio's agent emblem (src/lib/avatar.ts): a bust
  in a round dossier photo, with an ink ring.
-->
<script lang="ts">
  import type { Avatar } from '../lib/avatar';

  let { avatar, size = 40, ring = true }: { avatar: Avatar; size?: number; ring?: boolean } = $props();
</script>

<ewo-emblem class="av" theme="agent" value={avatar} {size} {ring}></ewo-emblem>

<style>
  .av {
    --ewo-emblem-ink: var(--ink);
    --ewo-emblem-paper: #ffffff;
  }
</style>
