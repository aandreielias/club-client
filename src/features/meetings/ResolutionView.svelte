<script lang="ts">
  import { bus } from '../../lib/container';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { RESOLUTION_CHANGED } from './events';
  import ResolutionCard from './ResolutionCard.svelte';
  import { meetingsApi } from './services';

  /** One resolution, e.g. from the circular vote's notification. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  // svelte-ignore state_referenced_locally
  const resolution = new Resource(() => meetingsApi.resolution(id));
  void resolution.load();
  view.title(() => resolution.value?.title);
  view.watch(RESOLUTION_CHANGED, (data) => data.resolutionId === id, {
    deleted: 'Dieser Beschluss wurde gelöscht.',
    busy: () => false,
    changed: () => void resolution.load(),
  });
</script>

<AsyncView resource={resolution}>
  {#snippet children(r)}
    <Detail title={r.meetingId ? 'Beschluss' : 'Umlaufbeschluss'}>
      <ResolutionCard resolution={r} onchanged={(updated) => resolution.set(updated)} ondeleted={() => view.leave()} />
    </Detail>
  {/snippet}
</AsyncView>
