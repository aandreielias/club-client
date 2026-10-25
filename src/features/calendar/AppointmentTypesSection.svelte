<script lang="ts">
  import { bus } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import type { Hue } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { HUES, type AppointmentTypeInfo, type AppointmentTypeInput } from './model';
  import { appointmentTypes, calendarApi } from './services';

  /** Einstellungen › Termine (admin/board): the club's kinds of appointments, their colour and what they offer. */
  void appointmentTypes.load().catch(() => {});

  const HUE_LABELS: Readonly<Record<Hue, string>> = {
    gray: 'Grau', brown: 'Braun', orange: 'Orange', yellow: 'Gelb', green: 'Grün', blue: 'Blau', purple: 'Violett', red: 'Rot',
  };
  const HUE_OPTIONS = HUES.map((h) => ({ value: h, label: HUE_LABELS[h] }));

  /** The type being edited: its key, '' for a new one, null for none. */
  let editing = $state<string | null>(null);
  let form = $state<AppointmentTypeInput>({ label: '', hue: 'blue', rides: false, cabins: true, sort: 10, archived: false });
  const action = new Action();

  function edit(type: AppointmentTypeInfo | null) {
    form = type ? { label: type.label, hue: type.hue, rides: type.rides, cabins: type.cabins, sort: type.sort, archived: type.archived }
      : { label: '', hue: 'blue', rides: false, cabins: true, sort: 10, archived: false };
    editing = type?.key ?? '';
    action.error = null;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (await action.run(() => calendarApi.saveType(editing || null, { ...form, label: form.label.trim() }))) {
      bus.publish(TOAST, { text: 'Terminart gespeichert.' });
      editing = null;
      await appointmentTypes.load();
    }
  }

  async function remove(type: AppointmentTypeInfo) {
    if (!(await bus.request(CONFIRM, { title: 'Terminart löschen', message: type.label, confirmLabel: 'Löschen', danger: true }))) return;
    if (await action.run(() => calendarApi.deleteType(type.key))) {
      editing = null;
      await appointmentTypes.load();
    }
  }
</script>

<div class="stack section">
  <p class="muted">Welche Arten von Terminen es gibt, in welcher Farbe sie im Kalender stehen und ob Fahrgemeinschaften und Kabinen angeboten werden.</p>
  <ul class="types">
    {#each appointmentTypes.items as type (type.key)}
      <li>
        <button type="button" class="type" class:active={editing === type.key} onclick={() => edit(type)}
          {@attach tooltip(`Terminart ${type.label} bearbeiten`)}>
          <Tag tone={type.hue}>{type.label}</Tag>
          <span class="muted small">{[type.rides && 'Fahrgemeinschaften', type.cabins && 'Kabinen'].filter(Boolean).join(' · ') || '—'}</span>
          {#if type.archived}<Tag tone="gray">Archiviert</Tag>{/if}
        </button>
      </li>
    {/each}
  </ul>
  <div><Button onclick={() => edit(null)}>Neue Terminart</Button></div>

  {#if editing !== null}
    {@const current = appointmentTypes.get(editing)}
    <form class="stack readable editor" onsubmit={save}>
      <div class="grid-2">
        <Field label="Bezeichnung">
          <input bind:value={form.label} maxlength="40" required />
        </Field>
        <Field label="Farbe">
          <Select bind:value={form.hue} options={HUE_OPTIONS} aria-label="Farbe" />
        </Field>
      </div>
      <label class="check"><input type="checkbox" bind:checked={form.rides} /> Fahrgemeinschaften anbieten</label>
      <label class="check"><input type="checkbox" bind:checked={form.cabins} /> Kabinen für Damen und Herren angeben</label>
      <Field label="Reihenfolge" hint="Kleinere Zahlen stehen weiter oben.">
        <input type="number" min="0" max="1000" bind:value={form.sort} class="short" />
      </Field>
      {#if current}
        <label class="check"><input type="checkbox" bind:checked={form.archived} /> Archiviert (für neue Termine nicht mehr wählbar)</label>
      {/if}
      <ErrorNote error={action.error} />
      <div class="row">
        <Button type="submit" variant="primary" busy={action.busy}>Speichern</Button>
        <Button variant="ghost" onclick={() => (editing = null)}>Abbrechen</Button>
        {#if current && !current.inUse}
          <Button variant="danger" onclick={() => remove(current)}>Löschen</Button>
        {/if}
      </div>
    </form>
  {/if}
</div>

<style>
  p {
    margin: 0;
  }
  .types {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .type {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 34px;
    padding: var(--space-xs) var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .type:hover {
    background: var(--color-hover);
  }
  .type.active {
    background: var(--color-selected);
  }
  .editor {
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border);
  }
  .short {
    width: 6rem;
  }
</style>
