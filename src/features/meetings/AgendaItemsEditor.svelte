<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Select from '../../ui/Select.svelte';
  import MemberChips from './MemberChips.svelte';
  import { emptyRow, MAX_ITEMS, type AgendaRow } from './agenda';
  import { MAJORITY_LABELS, type Majority, type Person } from './model';

  /**
   * The Tagesordnung as ordered items; any item can be a Beschluss: its text goes into the invitation, after the vote it becomes the task
   * "<Titel> umsetzen" for whoever is named (nobody: the Vorstand), due on the chosen day. Voted Beschlüsse stay as they are.
   */
  let {
    rows = $bindable(),
    majorities,
    candidates,
    today,
  }: { rows: AgendaRow[]; majorities: readonly Majority[]; candidates: readonly Person[]; today: string } = $props();

  const MAJORITIES = $derived(majorities.map((m) => ({ value: m, label: MAJORITY_LABELS[m] })));
  const defaultMajority = $derived<Majority>(majorities.includes('SIMPLE') ? 'SIMPLE' : (majorities[0] ?? 'SIMPLE'));

  function move(index: number, by: -1 | 1) {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    rows = next;
  }

  function add(beschluss: boolean) {
    rows = [...rows, emptyRow(beschluss)];
  }
</script>

<div class="stack">
  {#if rows.length}
    <ol class="items">
      {#each rows as row, i (row.key)}
        <li class="item stack" class:beschluss={row.beschluss}>
          <div class="row line">
            <span class="number">{i + 1}.</span>
            <input
              bind:value={row.title}
              maxlength="200"
              placeholder={row.beschluss ? 'Titel des Beschlusses' : 'Punkt der Tagesordnung'}
              aria-label="Punkt {i + 1}"
            />
            <Button size="sm" variant="ghost" icon="expand" tooltip="Nach oben" disabled={i === 0} onclick={() => move(i, -1)} />
            <Button
              size="sm"
              variant="ghost"
              icon="close"
              tooltip={row.locked ? 'Abgestimmte Beschlüsse bleiben' : 'Punkt entfernen'}
              disabled={row.locked}
              onclick={() => (rows = rows.filter((r) => r.key !== row.key))}
            />
          </div>
          <div class="body stack">
            <label class="check small">
              <input type="checkbox" bind:checked={row.beschluss} disabled={row.locked} />
              Beschluss: wird abgestimmt, angenommen wird er zur Aufgabe
            </label>
            {#if row.beschluss && row.locked}
              <p class="muted small">Schon abgestimmt; bleibt, wie er ist.</p>
            {:else if row.beschluss}
              <textarea
                bind:value={row.text}
                rows="3"
                maxlength="4000"
                placeholder="Antragstext: Was wird beschlossen?"
                aria-label="Antragstext zu Punkt {i + 1}"></textarea>
              <div class="grid-2">
                {#if MAJORITIES.length > 1}
                  <Select
                    options={MAJORITIES}
                    bind:value={() => row.majority ?? defaultMajority, (v) => (row.majority = v as Majority)}
                    aria-label="Mehrheit zu Punkt {i + 1}"
                  />
                {/if}
                <label class="due small">
                  Umsetzen bis
                  <DateInput bind:value={row.implementDue} min={today} />
                </label>
              </div>
              <MemberChips bind:value={row.assigneeIds} {candidates} label="Umsetzung durch" placeholder="Umsetzung durch (sonst Vorstand)" />
            {/if}
            <input bind:value={row.note} maxlength="1000" placeholder="Anmerkung (optional)" aria-label="Anmerkung zu Punkt {i + 1}" />
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted small">Noch keine Punkte. Beschlüsse hier eintragen: sie stehen in der Einladung.</p>
  {/if}
  <div class="row">
    <Button size="sm" icon="add" disabled={rows.length >= MAX_ITEMS} onclick={() => add(false)}>Punkt</Button>
    <Button size="sm" icon="add" disabled={rows.length >= MAX_ITEMS} onclick={() => add(true)}>Beschluss</Button>
  </div>
</div>

<style>
  .items {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .item.beschluss {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
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
  .body {
    padding-left: 1.6rem;
  }
  .due {
    display: grid;
    gap: var(--space-xxs);
  }
  p {
    margin: 0;
  }
</style>
