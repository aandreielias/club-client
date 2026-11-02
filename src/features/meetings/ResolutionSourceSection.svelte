<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { meetingsApi } from './services';

  /** The task "umsetzen" of a passed Beschluss: where it was decided (for who may see the resolution). */
  let { resolutionId }: { resolutionId: string } = $props();

  // svelte-ignore state_referenced_locally
  const resolution = new Resource(() => meetingsApi.resolution(resolutionId));
  void resolution.load();
</script>

{#if resolution.value}
  {@const r = resolution.value}
  <p class="source small">
    Aus dem Beschluss <RecordLink kind="resolution" id={r.id}>{r.title}</RecordLink>
    {#if r.meetingId}der <RecordLink kind="meeting" id={r.meetingId}>Sitzung</RecordLink>{:else}(Umlaufbeschluss){/if}
  </p>
{/if}

<style>
  .source {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
