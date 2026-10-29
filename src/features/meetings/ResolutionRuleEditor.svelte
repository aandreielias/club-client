<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
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
  const kinds = $derived(form.kinds());

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

  <fieldset class="stack">
    <legend>Folgeaufgaben</legend>
    <p class="muted small">
      Entstehen, wenn der Beschluss angenommen ist. Im Titel setzt {'{beschluss}'} den Beschluss, {'{mitglied}'} das betroffene Mitglied und
      {'{funktion}'} die Funktion ein. Ohne Fälligkeit hat die Aufgabe kein Datum.
    </p>
    {#if form.followUps.length}
      <div class="table" role="table" aria-label="Folgeaufgaben">
        <div class="head" role="row">
          <span role="columnheader">Art</span>
          <span role="columnheader">Titel</span>
          <span role="columnheader">Fällig nach Tagen</span>
          <span></span>
        </div>
        {#each form.followUps as followUp, i (followUp.id ?? `neu-${i}`)}
          <div class="line" role="row">
            <Select bind:value={followUp.kind} options={kinds} aria-label="Art der Folgeaufgabe" />
            <input bind:value={followUp.title} maxlength={RULE_LIMITS.title} aria-label="Titel der Folgeaufgabe" />
            <input
              type="number"
              min="0"
              max={RULE_LIMITS.dueDays}
              placeholder="ohne"
              aria-label="Fällig nach Tagen"
              bind:value={() => followUp.dueDays ?? '', (v) => (followUp.dueDays = v === '' || v == null ? null : Math.round(Number(v)))}
            />
            <Button size="sm" variant="ghost" icon="delete" tooltip="Folgeaufgabe entfernen" onclick={() => form.followUps.splice(i, 1)} />
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted small">Keine Folgeaufgaben.</p>
    {/if}
    <ErrorNote error={form.error('followUps')} />
    {#if form.followUps.length < RULE_LIMITS.followUps}
      <div><Button size="sm" icon="add" onclick={() => form.addFollowUp(`${name || 'Beschluss'}: {beschluss}`)}>Folgeaufgabe hinzufügen</Button></div>
    {/if}
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
  .table {
    display: grid;
    gap: var(--space-xs);
  }
  .head,
  .line {
    display: grid;
    grid-template-columns: 13rem minmax(10rem, 1fr) 6rem 2rem;
    gap: var(--space-sm);
    align-items: center;
  }
  .head {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
  :global([data-layout='compact']) .head {
    display: none;
  }
  :global([data-layout='compact']) .line {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-bottom: var(--space-xs);
    border-bottom: 1px solid var(--color-border);
  }
</style>
