<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import {
    ACTION_KIND_LABELS,
    AUDIENCE_LABELS,
    SYSTEM_STEP_LABELS,
    type MeetingStep,
    type StepAction,
    type StepAnchor,
    type StepAudience,
  } from './model';
  import { fromAmount, toAmount, type TimeUnit } from './timeline';

  /**
   * "Schritt bearbeiten": one step of a meeting type's timeline with labelled fields. It edits a copy; "Übernehmen" hands it back,
   * "Abbrechen" or Escape drops it. The server writes the text of its own two reminders, so those only change time and recipients.
   */
  let {
    step,
    isNew,
    onapply,
    onremove,
    onclose,
  }: {
    /** The step to edit; null closes the dialog. */
    step: MeetingStep | null;
    isNew: boolean;
    onapply: (step: MeetingStep) => void;
    onremove: () => void;
    onclose: () => void;
  } = $props();

  let draft = $state<MeetingStep | null>(null);
  let amount = $state(0);
  let unit = $state<TimeUnit>('days');
  let submitted = $state(false);
  let text = $state<HTMLTextAreaElement>();

  $effect.pre(() => {
    draft = step ? { ...step } : null;
    if (!step) return;
    ({ amount, unit } = toAmount(step.offsetHours));
    submitted = false;
  });

  const ANCHORS = [
    { value: 'BEFORE_INVITE', label: 'vor der Einladungsfrist', hint: 'solange die Sitzung nicht eingeladen ist' },
    { value: 'BEFORE_START', label: 'vor Beginn', hint: 'sobald eingeladen ist' },
    { value: 'AFTER_END', label: 'nach dem Ende', hint: 'wenn die Sitzung vorbei ist' },
  ] as const satisfies readonly { value: StepAnchor; label: string; hint: string }[];
  const UNITS = [
    { value: 'days', label: 'Tage' },
    { value: 'hours', label: 'Stunden' },
  ] as const;
  const AUDIENCES = (Object.keys(AUDIENCE_LABELS) as StepAudience[]).map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }));
  const STEP_ACTIONS = (Object.keys(ACTION_KIND_LABELS) as StepAction[]).map((a) => ({ value: a, label: ACTION_KIND_LABELS[a] }));
  const PLACEHOLDERS = [
    { value: '{titel}', hint: 'Titel der Sitzung' },
    { value: '{datum}', hint: 'Beginn der Sitzung' },
  ];

  const titleError = $derived(
    submitted && draft && !draft.system && (!draft.title?.trim() || draft.title.trim().length > 150) ? 'Titel mit 1 bis 150 Zeichen.' : undefined,
  );

  /** Puts a placeholder where the cursor stands in the text. */
  function insert(placeholder: string) {
    if (!draft) return;
    const body = draft.body ?? '';
    const at = text?.selectionStart ?? body.length;
    draft.body = body.slice(0, at) + placeholder + body.slice(text?.selectionEnd ?? at);
    queueMicrotask(() => {
      text?.focus();
      text?.setSelectionRange(at + placeholder.length, at + placeholder.length);
    });
  }

  function apply(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    if (!draft || titleError) return;
    onapply({ ...draft, offsetHours: fromAmount(amount, unit) });
  }
</script>

<Dialog open={!!step} title={isNew ? 'Neuer Schritt' : 'Schritt bearbeiten'} {onclose} wide>
  {#if draft}
    <form class="stack" onsubmit={apply} novalidate>
      {#if draft.system}
        <p><strong>{SYSTEM_STEP_LABELS[draft.system]}</strong></p>
        <p class="muted small">Den Text schreibt der Server; Zeitpunkt und Empfänger lassen sich ändern.</p>
      {:else}
        <Field label="Art" group>
          <ChoiceGroup name="step-action" label="Art" options={STEP_ACTIONS} bind:value={() => draft!.action, (v) => v && (draft!.action = v)} />
        </Field>
      {/if}
      <Field label="Zeitpunkt" hint={ANCHORS.find((a) => a.value === draft!.anchor)?.hint}>
        <div class="row when">
          <input type="number" min="0" max="8760" step="1" bind:value={amount} class="short" aria-label="Abstand" />
          <Select bind:value={unit} options={UNITS} aria-label="Einheit" />
          {#if draft.system}
            <span>{ANCHORS.find((a) => a.value === draft!.anchor)?.label}</span>
          {:else}
            <Select bind:value={() => draft!.anchor, (v) => v && (draft!.anchor = v)} options={ANCHORS} aria-label="Bezugspunkt" />
          {/if}
        </div>
      </Field>
      <Field label={draft.action === 'TASK' ? 'Zuständig' : 'Empfänger'}>
        <Select bind:value={() => draft!.audience, (v) => v && (draft!.audience = v)} options={AUDIENCES} aria-label="Empfänger" />
      </Field>
      {#if !draft.system}
        <Field label="Titel" error={titleError}>
          <input bind:value={() => draft!.title ?? '', (v) => (draft!.title = v)} maxlength="150" required />
        </Field>
        <Field label="Text (optional)">
          <textarea rows="3" maxlength="1000" bind:this={text} bind:value={() => draft!.body ?? '', (v) => (draft!.body = v)}></textarea>
        </Field>
        <div class="row placeholders">
          <span class="muted small">Einsetzen:</span>
          {#each PLACEHOLDERS as p (p.value)}
            <Button size="sm" variant="ghost" tooltip={p.hint} onclick={() => insert(p.value)}>{p.value}</Button>
          {/each}
        </div>
      {/if}
      <div class="row between">
        <div>
          {#if !isNew}<Button variant="ghost" icon="delete" onclick={onremove}>Schritt entfernen</Button>{/if}
        </div>
        <div class="row">
          <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
          <Button type="submit" variant="primary">Übernehmen</Button>
        </div>
      </div>
    </form>
  {/if}
</Dialog>

<style>
  p {
    margin: 0;
  }
  .when {
    flex-wrap: wrap;
  }
  .placeholders {
    gap: var(--space-xs);
  }
</style>
