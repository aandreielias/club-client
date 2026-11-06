<script lang="ts">
  import type { Action } from '../lib/state/Action.svelte';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';

  /** "Ältere laden" under a paged list: its error, then the centred button. `action` carries busy and error of the load. */
  let { action, onload, tooltip }: { action: Action; onload: () => unknown; tooltip?: string } = $props();
</script>

<ErrorNote error={action.error} />
<div class="more">
  <Button busy={action.busy} {tooltip} onclick={() => void onload()}>Ältere laden</Button>
</div>

<style>
  .more {
    display: flex;
    justify-content: center;
    margin-top: var(--space-md);
  }
</style>
