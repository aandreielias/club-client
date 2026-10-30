<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MeetingModel } from './MeetingModel.svelte';
  import type { AgendaItem, Meeting, Resolution } from './model';

  /** The agenda as ordered items, each may name the motion it votes on; saved together. */
  let { meeting, model, motions, onclose }: { meeting: Meeting; model: MeetingModel; motions: readonly Resolution[]; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let items = $state<AgendaItem[]>(
    meeting.agendaItems.length
      ? meeting.agendaItems.map((i) => ({ ...i }))
      : (meeting.agenda ?? '')
          .split('\n')
          .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
          .filter(Boolean)
          .map((title) => ({ id: null, title, note: null, resolutionId: null })),
  );
  let submitted = $state(false);
  const MOTIONS = $derived([{ value: '', label: 'Kein Antrag' }, ...motions.map((r) => ({ value: r.id, label: r.title }))]);
  const invalid = $derived(items.some((i) => !i.title.trim() || i.title.trim().length > 200));

  function move(index: number, by: -1 | 1) {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    items = next;
  }

  async function save() {
    submitted = true;
    if (invalid) return;
    if (await model.setAgenda(items.map((i) => ({ ...i, title: i.title.trim(), note: i.note?.trim() || null })))) onclose();
  }
</script>

<div class="stack editor">
  <ol class="items">
    {#each items as item, i (i)}
      <li class="stack">
        <div class="row line">
          <span class="number">{i + 1}.</span>
          <input bind:value={item.title} maxlength="200" placeholder="Punkt der Tagesordnung" aria-label="Punkt {i + 1}" />
          <Button size="sm" variant="ghost" icon="expand" tooltip="Nach oben" disabled={i === 0} onclick={() => move(i, -1)} />
          <Button size="sm" variant="ghost" icon="delete" tooltip="Punkt entfernen" onclick={() => (items = items.filter((_, k) => k !== i))} />
        </div>
        <div class="grid-2 extra">
          <input
            bind:value={() => item.note ?? '', (v) => (item.note = v || null)}
            maxlength="1000"
            placeholder="Anmerkung (optional)"
            aria-label="Anmerkung zu Punkt {i + 1}"
          />
          {#if motions.length}
            <Select
              options={MOTIONS}
              bind:value={() => item.resolutionId ?? '', (v) => (item.resolutionId = v || null)}
              aria-label="Antrag zu Punkt {i + 1}"
            />
          {/if}
        </div>
      </li>
    {/each}
  </ol>
  {#if submitted && invalid}<p class="error small" role="alert">Jeder Punkt braucht einen Titel (bis 200 Zeichen).</p>{/if}
  <div>
    <Button
      size="sm"
      icon="add"
      disabled={items.length >= 50}
      onclick={() => (items = [...items, { id: null, title: '', note: null, resolutionId: null }])}>Punkt hinzufügen</Button
    >
  </div>
  <ErrorNote error={model.action.error} />
  <div class="row">
    <Button variant="primary" busy={model.action.busy} onclick={save}>Tagesordnung speichern</Button>
    <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
  </div>
</div>

<style>
  .editor {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .items {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .line {
    flex-wrap: nowrap;
  }
  .line input {
    flex: 1;
    min-width: 0;
  }
  .number {
    width: 1.6rem;
    color: var(--color-text-muted);
  }
  .extra {
    padding-left: 1.6rem;
  }
  .error {
    margin: 0;
    color: var(--color-danger);
  }
</style>
