<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ChipToggle from '../../ui/ChipToggle.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { OFFICE_KINDS } from '../members/MembersApi';
  import { boardSettings } from '../members/services';
  import type { MeetingTypeForm } from './MeetingTypeForm.svelte';
  import TimelineBar from './TimelineBar.svelte';
  import { resolutionRules } from './services';
  import {
    ACTION_KIND_LABELS,
    ACTION_LABELS,
    ACTION_ORDER,
    AUDIENCE_LABELS,
    MAJORITY_LABELS,
    noticeText,
    QUORUM_LABELS,
    SYSTEM_STEP_LABELS,
    type Majority,
    type Quorum,
    type StepAction,
    type StepAnchor,
    type StepAudience,
  } from './model';

  /** Form of a meeting type: its rules, the timeline of steps around each meeting, who convenes, majorities and decisions. */
  let {
    form,
    action,
    submitLabel,
    canArchive,
    oncancel,
    onsubmit,
  }: {
    form: MeetingTypeForm;
    action: Action;
    submitLabel: string;
    /** Archiving only for types that exist. */
    canArchive: boolean;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();

  /** The step selected on the timeline. */
  let step = $state<number | null>(null);
  const selectedStep = $derived(step == null ? null : form.steps[step]);
  const ANCHORS = [
    { value: 'BEFORE_INVITE', label: 'vor der Einladungsfrist (solange nicht eingeladen)' },
    { value: 'BEFORE_START', label: 'vor Beginn (sobald eingeladen)' },
    { value: 'AFTER_END', label: 'nach dem Ende' },
  ] as const satisfies readonly { value: StepAnchor; label: string }[];
  const AUDIENCES = (Object.keys(AUDIENCE_LABELS) as StepAudience[]).map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }));
  const STEP_ACTIONS = (Object.keys(ACTION_KIND_LABELS) as StepAction[]).map((a) => ({ value: a, label: ACTION_KIND_LABELS[a] }));
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
  const OFFICES = OFFICE_KINDS.filter((o) => o !== 'AUDITOR');
  const MAJORITIES = Object.keys(MAJORITY_LABELS) as Majority[];

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  <div class="grid-2">
    <Field label="Bezeichnung" error={form.error('label')}>
      <input bind:value={form.label} maxlength="80" required />
    </Field>
    <Field label="In der Einladung" hint="„Einladung zur …“, z. B. ordentlichen Mitgliederversammlung" error={form.error('invitationLabel')}>
      <input bind:value={form.invitationLabel} maxlength="120" required />
    </Field>
  </div>
  <Field label="Eingeladen und stimmberechtigt">
    <ChoiceGroup
      name="type-electorate"
      label="Eingeladen und stimmberechtigt"
      options={ELECTORATES}
      bind:value={() => form.electorate, (v) => v && (form.electorate = v)}
    />
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
      <input
        type="number"
        min="1"
        max="1440"
        step="1"
        class="short"
        bind:value={() => form.grace ?? '', (v) => (form.grace = v === '' || v == null ? null : Number(v))}
      />
    </Field>
  </div>

  <fieldset>
    <legend>Ablauf rund um jede Sitzung</legend>
    <p class="muted small">
      Punkte ziehen oder mit den Pfeiltasten verschieben (Umschalt: eine Woche). Raute: letzter Tag zum Einladen. Kreis: Benachrichtigung, Quadrat:
      Aufgabe. Im Text setzt {'{titel}'} den Titel und {'{datum}'} den Beginn der Sitzung ein.
    </p>
    <TimelineBar
      noticeHours={form.noticeHours}
      steps={form.steps}
      selected={step}
      onnotice={(h) => form.setNoticeHours(h)}
      onmove={(i, h) => (form.steps[i].offsetHours = h)}
      onselect={(i) => (step = i)}
    />
    <div class="row">
      <Button size="sm" onclick={() => (step = form.addStep('BEFORE_START'))}>Schritt davor</Button>
      <Button size="sm" onclick={() => (step = form.addStep('AFTER_END'))}>Schritt danach</Button>
    </div>
    {#if selectedStep && step != null}
      {@const index = step}
      <div class="stack step">
        {#if selectedStep.system}
          <strong>{SYSTEM_STEP_LABELS[selectedStep.system]}</strong>
          <p class="muted small">Den Text schreibt der Server; Zeitpunkt und Empfänger lassen sich ändern.</p>
        {:else}
          <Field label="Titel">
            <input bind:value={() => selectedStep.title ?? '', (v) => (form.steps[index].title = v)} maxlength="150" />
          </Field>
          <Field label="Text (optional)">
            <textarea rows="2" maxlength="1000" bind:value={() => selectedStep.body ?? '', (v) => (form.steps[index].body = v)}></textarea>
          </Field>
          <Field label="Art">
            <ChoiceGroup
              name="step-action"
              label="Art"
              options={STEP_ACTIONS}
              bind:value={() => selectedStep.action, (v) => v && (form.steps[index].action = v)}
            />
          </Field>
          <Field label="Bezugspunkt">
            <Select bind:value={() => selectedStep.anchor, (v) => v && (form.steps[index].anchor = v)} options={ANCHORS} aria-label="Bezugspunkt" />
          </Field>
        {/if}
        <div class="grid-2">
          <Field label="Abstand in Stunden" hint="= {noticeText(selectedStep.offsetHours)}">
            <input
              type="number"
              min="0"
              max="8760"
              step="1"
              class="short"
              bind:value={() => selectedStep.offsetHours, (v) => (form.steps[index].offsetHours = Math.max(0, Math.round(Number(v) || 0)))}
            />
          </Field>
          <Field label="An">
            <Select
              bind:value={() => selectedStep.audience, (v) => v && (form.steps[index].audience = v)}
              options={AUDIENCES}
              aria-label="Empfänger"
            />
          </Field>
        </div>
        <div><Button size="sm" variant="ghost" onclick={() => (form.removeStep(index), (step = null))}>Entfernen</Button></div>
      </div>
    {/if}
    {#if form.error('steps')}<p class="danger small">{form.error('steps')}</p>{/if}
  </fieldset>

  <fieldset>
    <legend>Einberufen von</legend>
    <p class="muted small">Admins dürfen jede Sitzung anlegen. Die Schriftführung führt jede Sitzung mit.</p>
    <ChipToggle label="Einberufen von" options={OFFICES.map((o) => ({ value: o, label: boardSettings.label(o) }))} bind:value={form.conveners} />
    {#if form.error('conveners')}<p class="danger small">{form.error('conveners')}</p>{/if}
  </fieldset>

  <fieldset>
    <legend>Mögliche Mehrheiten</legend>
    <ChipToggle label="Mögliche Mehrheiten" options={MAJORITIES.map((m) => ({ value: m, label: MAJORITY_LABELS[m] }))} bind:value={form.majorities} />
    {#if form.error('majorities')}<p class="danger small">{form.error('majorities')}</p>{/if}
  </fieldset>

  <fieldset>
    <legend>Was Beschlüsse entscheiden dürfen</legend>
    <p class="muted small">Daraus entstehen nach dem Beschluss die Folgeaufgaben.</p>
    <ChipToggle
      label="Was Beschlüsse entscheiden dürfen"
      bind:value={form.actions}
      options={ACTION_ORDER.filter((x) => resolutionRules.enabled(x)).map((a) => ({ value: a, label: ACTION_LABELS[a], disabled: a === 'GENERAL' }))}
    />
  </fieldset>

  <fieldset>
    <legend>Optionen</legend>
    <label class="check"><input type="checkbox" bind:checked={form.needsReason} /> Die Einladung nennt den Grund der Dringlichkeit</label>
    <label class="check"><input type="checkbox" bind:checked={form.yearly} /> Findet jährlich statt (Erinnerung und Aufgabe für den Vorstand)</label>
  </fieldset>
  {#if form.yearly}
    <Field label="Geplant sein bis" error={form.error('dueBy')}>
      <div class="row">
        <input type="number" min="1" max="31" step="1" bind:value={form.dueDay} class="short" aria-label="Tag" />
        <Select bind:value={() => String(form.dueMonth), (v) => v && (form.dueMonth = Number(v))} options={MONTHS} aria-label="Monat" />
      </div>
    </Field>
  {/if}
  {#if canArchive}
    <label class="check"><input type="checkbox" bind:checked={form.archived} /> Archiviert (für neue Sitzungen nicht mehr wählbar)</label>
  {/if}

  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>

<style>
  p {
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
  .step {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .danger {
    color: var(--color-danger);
  }
</style>
