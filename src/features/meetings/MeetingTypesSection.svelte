<script lang="ts">
  import { bus } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { OFFICE_LABELS, type OfficeKind } from '../members/MembersApi';
  import { MeetingTypeForm } from './MeetingTypeForm.svelte';
  import { ACTION_LABELS, ACTION_ORDER, MAJORITY_LABELS, noticeText, QUORUM_LABELS, type Majority, type MeetingType, type Quorum } from './model';
  import { meetingsApi, meetingTypes } from './services';

  /** Einstellungen › Sitzungsarten (admin/board): the club's meeting types with their rules; seeded with the statutes' kinds. */
  void meetingTypes.load().catch(() => {});

  /** The type being edited: its key, or '' for a new one; null = none. */
  let editing = $state<string | null>(null);
  let form = $state(new MeetingTypeForm());
  const action = new Action();

  const ELECTORATES = [
    { value: 'BOARD', label: 'Vorstand' },
    { value: 'ASSEMBLY', label: 'Stimmberechtigte Mitglieder' },
  ] as const;
  const UNITS = [
    { value: 'days', label: 'Tage' },
    { value: 'hours', label: 'Stunden' },
  ] as const;
  const QUORUMS = (Object.keys(QUORUM_LABELS) as Quorum[]).map((q) => ({ value: q, label: QUORUM_LABELS[q] }));
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat('de-AT', { month: 'long' }).format(new Date(2024, i, 1)),
  }));
  const OFFICES = (Object.keys(OFFICE_LABELS) as OfficeKind[]).filter((o) => o !== 'AUDITOR');
  const MAJORITIES = Object.keys(MAJORITY_LABELS) as Majority[];

  function edit(type: MeetingType | null) {
    form = new MeetingTypeForm(type);
    editing = type?.key ?? '';
    action.error = null;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    if (await action.run(() => meetingsApi.saveType(editing || null, form.toInput()))) {
      bus.publish(TOAST, { text: 'Sitzungsart gespeichert.' });
      editing = null;
      await meetingTypes.load();
    }
  }

  async function remove(type: MeetingType) {
    if (!(await bus.request(CONFIRM, { title: 'Sitzungsart löschen', message: type.label, confirmLabel: 'Löschen', danger: true }))) return;
    if (await action.run(() => meetingsApi.deleteType(type.key))) {
      editing = null;
      await meetingTypes.load();
    }
  }
</script>

<div class="stack section">
  <p class="muted">
    Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung
    beschlussfähig ist und was sie beschließen darf. Die Vorgaben entsprechen den Statuten.
  </p>

  <ul class="types">
    {#each meetingTypes.items as type (type.key)}
      <li>
        <button type="button" class="type" class:active={editing === type.key} onclick={() => edit(type)}
          {@attach tooltip(`Regeln der ${type.label} bearbeiten`)}>
          <span class="name">{type.label}</span>
          <span class="muted small">
            {type.electorate === 'ASSEMBLY' ? 'Mitglieder' : 'Vorstand'} · Frist {noticeText(type.noticeHours)}{type.dueBy ? ' · jährlich' : ''}
          </span>
          {#if type.archived}<Tag tone="gray">Archiviert</Tag>{/if}
        </button>
      </li>
    {/each}
  </ul>
  <div><Button onclick={() => edit(null)}>Neue Sitzungsart</Button></div>

  {#if editing !== null}
    {@const current = meetingTypes.get(editing)}
    <form class="stack readable editor" onsubmit={save} novalidate>
      <h3>{current ? current.label : 'Neue Sitzungsart'}</h3>
      <div class="grid-2">
        <Field label="Bezeichnung" error={form.error('label')}>
          <input bind:value={form.label} maxlength="80" required />
        </Field>
        <Field label="In der Einladung" hint="„Einladung zur …“, z. B. ordentlichen Mitgliederversammlung" error={form.error('invitationLabel')}>
          <input bind:value={form.invitationLabel} maxlength="120" required />
        </Field>
      </div>
      <Field label="Bestimmung der Statuten (optional)" hint="Steht in der Einladung, z. B. § 8 Abs. 4">
        <input bind:value={form.statuteRef} maxlength="40" />
      </Field>
      <Field label="Eingeladen und stimmberechtigt">
        <ChoiceGroup name="type-electorate" label="Eingeladen und stimmberechtigt" options={ELECTORATES}
          bind:value={() => form.electorate, (v) => v && (form.electorate = v)} />
      </Field>
      <div class="grid-2">
        <Field label="Einladungsfrist" hint="So lange vor Beginn muss eingeladen sein." error={form.error('notice')}>
          <div class="row">
            <input type="number" min="0" step="1" bind:value={form.notice} class="short" />
            <Select bind:value={form.noticeUnit} options={UNITS} aria-label="Einheit der Einladungsfrist" />
          </div>
        </Field>
        <Field label="Reihenfolge" hint="Kleinere Zahlen stehen weiter oben.">
          <input type="number" min="0" max="1000" step="1" bind:value={form.sort} class="short" />
        </Field>
      </div>
      <div class="grid-2">
        <Field label="Beschlussfähig mit">
          <Select bind:value={form.quorum} options={QUORUMS} aria-label="Beschlussfähig mit" />
        </Field>
        <Field label="Danach beschlussfähig ohne Mindestzahl (optional)" hint="Minuten nach Beginn, wenn zu wenige da sind" error={form.error('grace')}>
          <input type="number" min="1" max="1440" step="1" class="short"
            bind:value={() => form.grace ?? '', (v) => (form.grace = v === '' || v == null ? null : Number(v))} />
        </Field>
      </div>

      <fieldset>
        <legend>Einberufen von</legend>
        <p class="muted small">Admins dürfen jede Sitzung anlegen. Die Schriftführung führt jede Sitzung mit.</p>
        {#each OFFICES as office (office)}
          <label class="check"><input type="checkbox" checked={form.conveners.includes(office)}
            onchange={(e) => (form.conveners = form.toggle(form.conveners, office, e.currentTarget.checked))} /> {OFFICE_LABELS[office]}</label>
        {/each}
        {#if form.error('conveners')}<p class="danger small">{form.error('conveners')}</p>{/if}
      </fieldset>

      <fieldset>
        <legend>Mögliche Mehrheiten</legend>
        {#each MAJORITIES as majority (majority)}
          <label class="check"><input type="checkbox" checked={form.majorities.includes(majority)}
            onchange={(e) => (form.majorities = form.toggle(form.majorities, majority, e.currentTarget.checked))} /> {MAJORITY_LABELS[majority]}</label>
        {/each}
        {#if form.error('majorities')}<p class="danger small">{form.error('majorities')}</p>{/if}
      </fieldset>

      <fieldset>
        <legend>Was Beschlüsse entscheiden dürfen</legend>
        <p class="muted small">Daraus entstehen nach dem Beschluss die Folgeaufgaben.</p>
        {#each ACTION_ORDER as a (a)}
          <label class="check"><input type="checkbox" checked={form.actions.includes(a)} disabled={a === 'GENERAL'}
            onchange={(e) => (form.actions = form.toggle(form.actions, a, e.currentTarget.checked))} /> {ACTION_LABELS[a]}</label>
        {/each}
      </fieldset>

      <label class="check"><input type="checkbox" bind:checked={form.needsReason} /> Die Einladung nennt den Grund der Dringlichkeit</label>
      <label class="check"><input type="checkbox" bind:checked={form.yearly} /> Findet jährlich statt (Erinnerung und Aufgabe für den Vorstand)</label>
      {#if form.yearly}
        <Field label="Geplant sein bis" error={form.error('dueBy')}>
          <div class="row">
            <input type="number" min="1" max="31" step="1" bind:value={form.dueDay} class="short" aria-label="Tag" />
            <Select bind:value={() => String(form.dueMonth), (v) => v && (form.dueMonth = Number(v))} options={MONTHS} aria-label="Monat" />
          </div>
        </Field>
      {/if}
      {#if current}
        <label class="check"><input type="checkbox" bind:checked={form.archived} /> Archiviert (für neue Sitzungen nicht mehr wählbar)</label>
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
    align-items: baseline;
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
  .name {
    font-weight: var(--font-weight-medium);
  }
  .editor {
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border);
  }
  h3 {
    margin: 0;
  }
  fieldset {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-weight: var(--font-weight-medium);
  }
  .short {
    width: 6rem;
  }
  .danger {
    color: var(--color-danger);
  }
</style>
