<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { boardSettings } from '../members/services';
  import {
    ACTION_KIND_LABELS,
    AUDIENCE_LABELS,
    stepName,
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
    steps,
    isNew,
    onapply,
    onremove,
    onclose,
  }: {
    /** The step to edit; null closes the dialog. */
    step: MeetingStep | null;
    /** All steps of the type, to pick the one a step follows. */
    steps: readonly MeetingStep[];
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
    { value: 'AFTER_CREATE', label: 'nach dem Anlegen', hint: 'ab dem Anlegen der Sitzung (etwa der Anrufung), bis sie endet' },
    {
      value: 'AFTER_STEP',
      label: 'nach Abschluss von',
      hint: 'sobald der gewählte Schritt erledigt ist (Aufgabe erledigt, Benachrichtigung versandt); eine Aufgabe kommt dann gleich, fällig nach dem Abstand',
    },
  ] as const satisfies readonly { value: StepAnchor; label: string; hint: string }[];
  const UNITS = [
    { value: 'days', label: 'Tage' },
    { value: 'hours', label: 'Stunden' },
  ] as const;
  const AUDIENCES = (Object.keys(AUDIENCE_LABELS) as StepAudience[]).map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }));
  const OFFICES = $derived(boardSettings.enabled.map((o) => ({ value: o, label: boardSettings.label(o) })));
  const officeError = $derived(submitted && draft?.audience === 'OFFICE' && !draft.office ? 'Ein Amt wählen.' : undefined);
  const STEP_ACTIONS = (Object.keys(ACTION_KIND_LABELS) as StepAction[]).map((a) => ({ value: a, label: ACTION_KIND_LABELS[a] }));
  const PLACEHOLDERS = [
    { value: '{titel}', hint: 'Titel der Sitzung' },
    { value: '{datum}', hint: 'Beginn der Sitzung' },
  ];

  /** Steps this one may follow: saved or new ones with an id, never itself or one that (through others) follows it. */
  const PREVIOUS = $derived.by(() => {
    if (!draft) return [];
    const own = draft.id;
    const followsOwn = (s: MeetingStep): boolean => {
      for (let at: MeetingStep | undefined = s, hops = 0; at && hops <= steps.length; hops++) {
        if (at.id === own) return true;
        at = at.anchor === 'AFTER_STEP' ? steps.find((x) => x.id === at!.after) : undefined;
      }
      return false;
    };
    return steps.filter((s) => s.id && !followsOwn(s)).map((s) => ({ value: s.id!, label: stepName(s) }));
  });
  const afterError = $derived(submitted && draft?.anchor === 'AFTER_STEP' && !draft.after ? 'Einen Schritt wählen.' : undefined);

  const titleError = $derived(
    submitted && draft && !draft.system && (!draft.title?.trim() || draft.title.trim().length > 150)
      ? 'Titel mit 1 bis 150 Zeichen angeben.'
      : undefined,
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
    if (!draft || titleError || officeError || afterError) return;
    onapply({
      ...draft,
      offsetHours: fromAmount(amount, unit),
      office: draft.audience === 'OFFICE' ? draft.office : null,
      after: draft.anchor === 'AFTER_STEP' ? draft.after : null,
    });
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
      {#if draft.anchor === 'AFTER_STEP'}
        <Field label="Folgt auf" error={afterError}>
          <Select
            bind:value={() => draft!.after ?? '', (v) => (draft!.after = v || null)}
            options={[{ value: '', label: 'Schritt wählen' }, ...PREVIOUS]}
            aria-label="Folgt auf"
          />
        </Field>
      {/if}
      <Field label={draft.action === 'TASK' ? 'Zuständig' : 'Empfänger'}>
        <Select bind:value={() => draft!.audience, (v) => v && (draft!.audience = v)} options={AUDIENCES} aria-label="Empfänger" />
      </Field>
      {#if draft.audience === 'OFFICE'}
        <Field label="Amt" hint="Alle, die es gerade innehaben; unbesetzt: der Vorstand." error={officeError}>
          <Select
            bind:value={() => draft!.office ?? '', (v) => (draft!.office = v || null)}
            options={[{ value: '', label: 'Amt wählen' }, ...OFFICES]}
            aria-label="Amt"
          />
        </Field>
      {/if}
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
        <div class="row">
          <Button type="submit" variant="primary">Übernehmen</Button>
          <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
        </div>
        {#if !isNew}<Button variant="danger" icon="delete" onclick={onremove}>Schritt entfernen</Button>{/if}
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
