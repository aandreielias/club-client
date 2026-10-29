<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import StatutesPlaceField from './StatutesPlaceField.svelte';
  import FollowUpFlow from './FollowUpFlow.svelte';
  import { RULE_LIMITS, type ResolutionRuleForm, type RuleMajority } from './ResolutionRuleForm.svelte';

  /** Form of one decision: its name (the club's own), the majority it fixes, and the tasks that follow when it passes. */
  let {
    form,
    name,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: {
    form: ResolutionRuleForm;
    /** The decision's name for titles of new follow-ups. */
    name: string;
    action: Action;
    submitLabel: string;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();

  const MAJORITIES: { value: RuleMajority; label: string; hint: string }[] = [
    { value: 'FREE', label: 'Frei', hint: 'Wer den Beschluss stellt, wählt die Mehrheit.' },
    { value: 'SIMPLE', label: 'Einfach', hint: 'Mehr Ja als Nein; Enthaltungen zählen nicht.' },
    { value: 'TWO_THIRDS', label: 'Zwei Drittel', hint: 'Mindestens doppelt so viele Ja wie Nein.' },
    { value: 'THREE_QUARTERS', label: 'Drei Viertel', hint: 'Mindestens dreimal so viele Ja wie Nein.' },
  ];

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  {#if form.own}
    <Field label="Name" hint="Etwa „Budget“ oder „Beitragshöhe“." error={form.error('label')}>
      <input bind:value={form.label} maxlength={RULE_LIMITS.label} required />
    </Field>
  {/if}
  <Field label="Mehrheit" hint={MAJORITIES.find((m) => m.value === form.majority)?.hint}>
    <ChoiceGroup name="rule-majority" label="Mehrheit" options={MAJORITIES} bind:value={() => form.majority, (v) => v && (form.majority = v)} />
  </Field>

  {#if form.statutes}
    <fieldset class="stack">
      <legend>Neue Statuten</legend>
      <p class="muted small">Gilt für den ganzen Verein. Ohne Ordner wird die Folgeaufgabe „Neue Statuten hochladen“ von Hand erledigt.</p>
      <StatutesPlaceField bind:value={form.statutes} />
    </fieldset>
  {/if}

  <fieldset class="stack">
    <legend>Folgeaufgaben</legend>
    <p class="muted small">
      Entstehen der Reihe nach, wenn der Beschluss angenommen ist. Im Titel, in der Beschreibung und in der Checkliste setzt {'{beschluss}'} den Beschluss,
      {'{mitglied}'} das betroffene Mitglied und {'{funktion}'} die Funktion ein.
    </p>
    <FollowUpFlow
      bind:followUps={form.followUps}
      kinds={form.kinds()}
      namesMember={form.namesMember}
      newTitle={`${name || 'Beschluss'}: {beschluss}`}
    />
    <ErrorNote error={form.error('followUps')} />
  </fieldset>

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
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-weight: var(--font-weight-medium);
  }
</style>
