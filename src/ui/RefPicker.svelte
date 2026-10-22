<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import { searchApi } from '../features/search/services';
  import { kindLabel, type HitKind } from '../features/search/model';
  import type { RefList } from '../lib/records/RefList.svelte';
  import { REF_ICONS, type RefKind } from '../lib/records/refs';

  /** Linking records (message, meeting): search like the global search, picked records as removable chips. */
  let { form, label = 'Verknüpfen (optional)', perKind = 5 }: { form: RefList; label?: string; perKind?: number } = $props();

  const LINKABLE: readonly HitKind[] = ['APPOINTMENT', 'TASK', 'ITEM', 'FILE', 'MEMBER', 'TEAM', 'LOCATION', 'TOURNAMENT', 'MEETING'];
  let found = new Map<string, { kind: RefKind; id: string; title: string }>();

  async function search(query: string) {
    if (query.trim().length < 2) return [];
    const hits = (await searchApi.search(query, perKind)).filter((h) => LINKABLE.includes(h.kind));
    found = new Map(hits.map((h) => [`${h.kind}:${h.id}`, { kind: h.kind as RefKind, id: h.id, title: h.title }]));
    return hits
      .filter((h) => !form.hasRef(h.kind as RefKind, h.id))
      .map((h) => ({ value: `${h.kind}:${h.id}`, label: `${kindLabel(h.kind)} · ${h.title}` }));
  }
</script>

<div class="stack refs">
  <span class="label">{label} <span class="muted">– suchen oder Einträge aus Listen, Kalender und Namen hierher ziehen</span></span>
  {#if form.refs.length < form.max}
    <SearchSelect {search} onpick={(value) => { const ref = found.get(value); if (ref) form.addRef(ref); }}
      placeholder="Termin, Aufgabe, Person, Team, Ort, Turnier, Sitzung, Inventar oder Datei suchen" aria-label="Datensatz zum Verknüpfen suchen" debounceMs={200} />
  {/if}
  {#if form.refs.length}
    <ul class="chips">
      {#each form.refs as ref (`${ref.kind}:${ref.id}`)}
        <li>
          <Icon name={REF_ICONS[ref.kind]} small />
          <span class="muted">{kindLabel(ref.kind)}</span>
          <span class="title">{ref.title}</span>
          <Button size="sm" variant="ghost" icon="close" tooltip="Verknüpfung entfernen" onclick={() => form.removeRef(ref)} />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .label {
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chips li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    max-width: 100%;
    padding: 0 var(--space-xxs) 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    font-size: var(--font-size-small);
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
