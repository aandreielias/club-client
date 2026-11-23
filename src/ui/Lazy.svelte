<script lang="ts">
  import type { Component } from 'svelte';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';

  /** Renders a component whose code is fetched on first use (see lazy.ts). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forwards whatever props the wrapped component takes
  let { load, props }: { load: () => Promise<Component<any>>; props: Record<string, unknown> } = $props();
</script>

{#await load() then Loaded}
  <Loaded {...props} />
{:catch error}
  <!-- Mostly after a new deploy: the old chunk names are gone, a reload fetches the new ones. -->
  <div class="stack">
    <ErrorNote {error} />
    <div><Button onclick={() => location.reload()}>Neu laden</Button></div>
  </div>
{/await}
