<script lang="ts">
  import { session } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { RESULT_LABELS, RESULT_TONES, type Result, type ResolutionSummary } from './model';
  import { meetingsApi, resolutionRules } from './services';

  /** Every resolution the member may see (meetings and circular votes), filtered by year, result and kind of decision. */
  const thisYear = new Date().getFullYear();
  let year = $state<string>('');
  let result = $state<string>('');
  let decision = $state<string>('');
  const list = new Resource(() => meetingsApi.allResolutions(year ? Number(year) : null));
  $effect(() => {
    void year;
    void list.load();
  });

  const YEARS = [
    { value: '', label: 'Alle Jahre' },
    ...Array.from({ length: 6 }, (_, i) => ({ value: String(thisYear - i), label: String(thisYear - i) })),
  ];
  const RESULTS = [
    { value: '', label: 'Alle Ergebnisse' },
    ...(Object.keys(RESULT_LABELS) as Result[]).map((r) => ({ value: r, label: RESULT_LABELS[r] })),
  ];
  const DECISIONS = $derived([
    { value: '', label: 'Alle Beschlussarten' },
    ...resolutionRules.all().map((a) => ({ value: a, label: resolutionRules.label(a) })),
  ]);
  const shown = (items: ResolutionSummary[]) => items.filter((r) => (!result || r.result === result) && (!decision || r.action === decision));
</script>

<section class="stack">
  <h2>Beschlüsse</h2>
  <div class="row filters">
    <Select options={YEARS} bind:value={year} aria-label="Jahr" />
    <Select options={RESULTS} bind:value={result} aria-label="Ergebnis" />
    <Select options={DECISIONS} bind:value={decision} aria-label="Beschlussart" />
  </div>
  <AsyncView resource={list}>
    {#snippet children(items)}
      <ul class="list">
        {#each shown(items) as r (r.id)}
          <li>
            <RecordLink kind="resolution" id={r.id}>{r.title}</RecordLink>
            {#if r.result}<Tag tone={RESULT_TONES[r.result]}>{RESULT_LABELS[r.result]}</Tag>{:else if r.status === 'OPEN'}<Tag tone="green">Offen</Tag
              >{:else}<Tag tone="gray">Entwurf</Tag>{/if}
            <span class="muted small">
              {resolutionRules.label(r.action)} · {r.meetingTitle ?? 'Umlaufbeschluss'}{#if r.closedAt}
                · {session.format.date(session.clock.localDate(r.closedAt))}{/if}
            </span>
          </li>
        {:else}
          <li class="muted">Keine Beschlüsse.</li>
        {/each}
      </ul>
    {/snippet}
  </AsyncView>
</section>

<style>
  h2 {
    margin: 0;
  }
  .filters {
    flex-wrap: wrap;
  }
  .list {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: baseline;
  }
</style>
