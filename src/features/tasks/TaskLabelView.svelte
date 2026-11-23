<script lang="ts">
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import TaskCatalogView from './TaskCatalogView.svelte';

  let { id, handle }: { id: string; handle: WindowHandle } = $props();
</script>

<TaskCatalogView {id} {handle} />
