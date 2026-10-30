<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { meetingsApi } from './services';

  /** Where a meeting follow-up task comes from: its meeting or resolution, and the task it waited for. */
  let { followUpId }: { followUpId: string } = $props();

  // svelte-ignore state_referenced_locally
  const source = new Resource(() => meetingsApi.followUpSource(followUpId));
  void source.load();
</script>

{#if source.value}
  {@const s = source.value}
  <p class="source small">
    Folgeaufgabe
    {#if s.resolutionId}aus dem Beschluss <RecordLink kind="resolution" id={s.resolutionId}>{s.resolutionTitle}</RecordLink>{/if}
    {#if s.meetingId}{s.resolutionId ? 'in' : 'der Sitzung'} <RecordLink kind="meeting" id={s.meetingId}>{s.meetingTitle}</RecordLink>{/if}
    {#if s.waitsForTitle}· startete nach „{s.waitsForTitle}“{/if}
  </p>
{/if}

<style>
  .source {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
