<script lang="ts">
  import { background } from '../../lib/state/background';
  import { directory, permissions, session } from '../../lib/container';
  import type { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';
  import type { StockForm } from './StockForm.svelte';

  /** "Wo ist es?" in edit mode: one line per place or person with a count; the sum becomes the stock. */
  let { form, action, oncancel, onsubmit }: { form: StockForm; action: Action; oncancel: () => void; onsubmit: () => void } = $props();

  let places = $state<Location[]>([]);
  let people = $state<{ memberId: string; name: string }[]>([]);
  locationsApi.list().then((list) => (places = list), () => {});
  // Admin and board pick anyone; coaches the members of their teams (the server accepts any active member).
  background((async () => {
    await directory.loadRosters();
    const lists = permissions.isManager
      ? [await directory.candidates(null)]
      : await Promise.all(permissions.manageableTeams().map((t) => directory.candidates(t.id)));
    const unique = new Map(lists.flat().map((p) => [p.memberId, p]));
    if (!unique.has(session.member.id)) unique.set(session.member.id, { memberId: session.member.id, name: `${session.member.firstName} ${session.member.lastName}` });
    people = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  })());

  /** Lines may name a place or person that is no longer offered (deleted place, other team): keep it selectable. */
  const options = $derived([
    { value: 'none', label: 'Ohne Ort' },
    ...places.map((l) => ({ value: `location:${l.id}`, label: `Ort · ${l.name}` })),
    ...people.map((p) => ({ value: `person:${p.memberId}`, label: `Person · ${p.name}` })),
    ...form.lines
      .filter((l) => l.place !== 'none' && !places.some((p) => `location:${p.id}` === l.place) && !people.some((p) => `person:${p.memberId}` === l.place))
      .map((l) => ({ value: l.place, label: l.place.startsWith('person:') ? `Person · ${directory.nameOf(l.place.slice(7))}` : 'Ort · (gelöscht)' })),
  ]);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.error) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate>
  <ul class="lines">
    {#each form.lines as line, i (line.key)}
      <li>
        <Select bind:value={line.place} options={options} aria-label="Ort oder Person, Zeile {i + 1}" />
        <input type="number" bind:value={line.quantity} min="1" aria-label="Anzahl, Zeile {i + 1}" />
        <Button size="sm" variant="ghost" icon="close" tooltip="Zeile entfernen" disabled={form.lines.length === 1} onclick={() => form.remove(line.key)} />
      </li>
    {/each}
  </ul>
  <div class="row between">
    <Button size="sm" icon="add" onclick={() => form.add()}>Zeile hinzufügen</Button>
    <span class="muted total">Gesamt: <strong>{form.total}</strong></span>
  </div>
  {#if form.submitted && form.error}<p class="error" role="alert">{form.error}</p>{/if}
  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>Speichern</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>

<style>
  .lines {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lines li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 6rem auto;
    gap: var(--space-sm);
    align-items: center;
  }
  .between {
    justify-content: space-between;
    align-items: center;
  }
  .total {
    font-variant-numeric: tabular-nums;
  }
  .error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
