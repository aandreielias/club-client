<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import type { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';
  import Select from '../../ui/Select.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { boardSettings } from '../members/services';
  import MeetingStepDialog from './MeetingStepDialog.svelte';
  import type { MeetingTypeForm } from './MeetingTypeForm.svelte';
  import TimelineBar from './TimelineBar.svelte';
  import {
    ACTION_KIND_LABELS,
    AUDIENCE_LABELS,
    MAJORITY_LABELS,
    noticeText,
    QUORUM_LABELS,
    STEP_ANCHOR_TEXT,
    SYSTEM_STEP_LABELS,
    type Majority,
    type MeetingStep,
    type Quorum,
    type StepAnchor,
  } from './model';

  /**
   * Form of a meeting type in titled parts: who is invited, the notice, when it can decide, what it may decide, the timeline of steps
   * around each meeting (each step opens in a dialog) and online participation.
   */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: {
    form: MeetingTypeForm;
    action: Action;
    submitLabel: string;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();

  /** The step open in the dialog: an index into the form's steps, or a new one not yet added. */
  let open = $state<{ index: number | null; step: MeetingStep } | null>(null);

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
  const MAJORITY_HINTS: Readonly<Record<Majority, string>> = {
    SIMPLE: 'Mehr Ja als Nein; Enthaltungen zählen nicht.',
    TWO_THIRDS: 'Mindestens doppelt so viele Ja wie Nein.',
    THREE_QUARTERS: 'Mindestens dreimal so viele Ja wie Nein.',
  };
  // Functions the club uses (Einstellungen › Funktionen); one already chosen stays visible so it can be removed.
  const OFFICES = $derived(
    boardSettings.all
      .filter((o) => o !== 'AUDITOR' && (boardSettings.enabled.includes(o) || form.conveners.includes(o)))
      .map((o) => ({
        value: o,
        label: boardSettings.label(o),
      })),
  );
  const MAJORITIES = (Object.keys(MAJORITY_LABELS) as Majority[]).map((m) => ({ value: m, label: MAJORITY_LABELS[m], hint: MAJORITY_HINTS[m] }));

  const stepName = (step: MeetingStep) => (step.system ? SYSTEM_STEP_LABELS[step.system] : step.title || 'Ohne Titel');

  function edit(index: number) {
    open = { index, step: form.steps[index] };
  }

  function add(anchor: StepAnchor) {
    open = { index: null, step: form.newStep(anchor) };
  }

  function apply(step: MeetingStep) {
    if (open?.index == null) form.steps.push(step);
    else form.steps[open.index] = step;
    open = null;
  }

  /** Taken out at once; the toast brings it back to its place. */
  function remove() {
    const index = open?.index;
    open = null;
    if (index == null) return;
    const [step] = form.steps.splice(index, 1);
    bus.publish(TOAST, {
      text: `„${stepName(step)}“ entfernt.`,
      action: { label: 'Rückgängig', run: () => form.steps.splice(Math.min(index, form.steps.length), 0, step) },
    });
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack editor" onsubmit={submit} novalidate {@attach autofocus}>
  <fieldset>
    <legend>Allgemein</legend>
    <div class="grid-2">
      <Field label="Bezeichnung" error={form.error('label')}>
        <input bind:value={form.label} maxlength="80" required />
      </Field>
      <Field label="In der Einladung" hint="„Einladung zur …“, z. B. ordentlichen Mitgliederversammlung" error={form.error('invitationLabel')}>
        <input bind:value={form.invitationLabel} maxlength="120" required />
      </Field>
    </div>
    <Field label="Eingeladen und stimmberechtigt" group>
      <ChoiceGroup
        name="type-electorate"
        label="Eingeladen und stimmberechtigt"
        options={ELECTORATES}
        bind:value={() => form.electorate, (v) => v && (form.electorate = v)}
      />
    </Field>
  </fieldset>

  <fieldset>
    <legend>Einladung & Frist</legend>
    <Field label="Einladungsfrist" hint="So lange vor Beginn muss eingeladen sein." error={form.error('notice')}>
      <div class="row">
        <input type="number" min="0" step="1" bind:value={form.notice} class="short" />
        <Select bind:value={form.noticeUnit} options={UNITS} aria-label="Einheit der Einladungsfrist" />
      </div>
    </Field>
    <Field
      label="Einberufen von"
      hint="Admins dürfen jede Sitzung anlegen; die Schriftführung führt jede Sitzung mit."
      error={form.error('conveners')}
    >
      <OptionList label="Einberufen von" options={OFFICES} bind:value={form.conveners} />
    </Field>
    <label class="check"><input type="checkbox" bind:checked={form.needsReason} /> Die Einladung nennt den Grund der Dringlichkeit</label>
    <label class="check"><input type="checkbox" bind:checked={form.yearly} /> Findet jährlich statt (Erinnerung und Aufgabe für den Vorstand)</label>
    {#if form.yearly}
      <div class="nested">
        <Field label="Geplant sein bis" error={form.error('dueBy')}>
          <div class="row">
            <input type="number" min="1" max="31" step="1" bind:value={form.dueDay} class="short" aria-label="Tag" />
            <Select bind:value={() => String(form.dueMonth), (v) => v && (form.dueMonth = Number(v))} options={MONTHS} aria-label="Monat" />
          </div>
        </Field>
      </div>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Beschlussfähigkeit</legend>
    <div class="grid-2">
      <Field label="Beschlussfähig mit">
        <Select bind:value={form.quorum} options={QUORUMS} aria-label="Beschlussfähig mit" />
      </Field>
      <Field label="Danach ohne Mindestzahl (optional)" hint="Minuten nach Beginn, wenn zu wenige da sind" error={form.error('grace')}>
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
  </fieldset>

  <fieldset>
    <legend>Beschlüsse</legend>
    <Field
      label="Mögliche Mehrheiten"
      hint="Jeder Beschluss wählt eine davon; vorgegeben ist die einfache Mehrheit."
      error={form.error('majorities')}
    >
      <OptionList label="Mögliche Mehrheiten" options={MAJORITIES} bind:value={form.majorities} />
    </Field>
  </fieldset>

  <fieldset>
    <legend class="row">
      Ablauf rund um jede Sitzung
      <Button
        size="sm"
        variant="ghost"
        icon="help"
        tooltip="Raute: letzter Tag zum Einladen. Kreis: Benachrichtigung, Quadrat: Aufgabe. Ziehen oder mit den Pfeiltasten verschieben (Umschalt: eine Woche); Klick öffnet den Schritt."
      />
    </legend>
    <TimelineBar
      noticeHours={form.noticeHours}
      steps={form.steps}
      selected={open?.index ?? null}
      onnotice={(h) => form.setNoticeHours(h)}
      onmove={(i, h) => (form.steps[i].offsetHours = h)}
      onselect={edit}
    />
    <ul class="steps">
      {#each form.steps as step, i (step.id ?? `neu-${i}`)}
        <li>
          <button type="button" class="step" onclick={() => edit(i)} {@attach tooltip('Schritt öffnen')}>
            <span class="when">{noticeText(step.offsetHours)} {STEP_ANCHOR_TEXT[step.anchor]}</span>
            <span class="name">{stepName(step)}</span>
            <span class="muted small">{ACTION_KIND_LABELS[step.action]} · {AUDIENCE_LABELS[step.audience]}</span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="row">
      <Button size="sm" icon="add" onclick={() => add('BEFORE_START')}>Schritt davor</Button>
      <Button size="sm" icon="add" onclick={() => add('AFTER_END')}>Schritt danach</Button>
    </div>
    <ErrorNote error={form.error('steps')} />
  </fieldset>

  <fieldset>
    <legend>Online-Teilnahme</legend>
    <label class="check"><input type="checkbox" bind:checked={form.selfCheckIn} /> Stimmberechtigte melden sich in der App selbst als anwesend</label>
    <label class="check"><input type="checkbox" bind:checked={form.online} /> Online-Teilnahme möglich (Link in jeder Sitzung dieser Art)</label>
    {#if form.online}
      <div class="nested">
        <Field
          label="Ständiger Link zur Videokonferenz (optional)"
          hint="Etwa der feste Videoraum des Vorstands; einzelne Sitzungen können einen eigenen haben. Ohne ständigen Link braucht jede Sitzung einen."
          error={form.error('videoUrl')}
        >
          <input type="url" bind:value={form.videoUrl} maxlength="500" placeholder="https://" />
        </Field>
      </div>
    {/if}
  </fieldset>

  <div class="bar stack">
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
      <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
    </div>
  </div>
</form>

<MeetingStepDialog step={open?.step ?? null} isNew={open?.index == null} onapply={apply} onremove={remove} onclose={() => (open = null)} />

<style>
  .editor {
    gap: var(--space-lg);
  }
  fieldset {
    display: grid;
    gap: var(--space-sm);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }
  legend {
    margin-bottom: var(--space-sm);
    color: var(--color-text);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
  }
  .nested {
    padding-left: var(--space-lg);
  }
  .steps {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .step {
    display: grid;
    grid-template-columns: 13rem minmax(0, 1fr) auto;
    gap: var(--space-sm);
    align-items: baseline;
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .step:hover {
    background: var(--color-hover);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global([data-layout='compact']) .step {
    grid-template-columns: minmax(0, 1fr);
  }
  .bar {
    position: sticky;
    bottom: 0;
    z-index: 1;
    padding: var(--space-sm) 0;
    background: var(--color-elevated);
  }
</style>
