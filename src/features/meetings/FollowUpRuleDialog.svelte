<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Field from '../../ui/Field.svelte';
  import ListEditor from '../../ui/ListEditor.svelte';
  import Select from '../../ui/Select.svelte';
  import { boardSettings } from '../members/services';
  import { ASSIGNEE_LABELS, AUTOMATIC_FOLLOW_UPS, FOLLOW_UP_KIND_LABELS, type FollowUpAssignee, type FollowUpRule } from './model';
  import { followUpProblem, RULE_LIMITS } from './ResolutionRuleForm.svelte';

  /**
   * "Folgeaufgabe": one follow-up of a decision in four parts (Was, Wer, Wann, Details). It edits a copy; "Übernehmen" hands it back.
   */
  let {
    followUp,
    position,
    canWait,
    isNew,
    kinds,
    namesMember,
    onapply,
    onremove,
    onclose,
  }: {
    /** null closes the dialog. */
    followUp: FollowUpRule | null;
    /** 1-based place in the list. */
    position: number;
    /** There is a follow-up before it to wait for. */
    canWait: boolean;
    isNew: boolean;
    kinds: readonly { value: FollowUpRule['kind']; label: string }[];
    /** The decision is about one member: the task may go to them. */
    namesMember: boolean;
    onapply: (followUp: FollowUpRule) => void;
    onremove: () => void;
    onclose: () => void;
  } = $props();

  let draft = $state<FollowUpRule | null>(null);
  let submitted = $state(false);
  let titleInput = $state<HTMLInputElement>();

  $effect.pre(() => {
    draft = followUp ? { ...followUp, checklist: [...followUp.checklist] } : null;
    submitted = false;
  });

  const PLACEHOLDERS = [
    { value: '{beschluss}', hint: 'Titel des Beschlusses' },
    { value: '{mitglied}', hint: 'Das betroffene Mitglied' },
    { value: '{funktion}', hint: 'Die betroffene Funktion' },
  ];
  const WHO = $derived(
    (Object.keys(ASSIGNEE_LABELS) as FollowUpAssignee[])
      .filter((a) => a !== 'MEMBER' || namesMember)
      .map((a) => ({ value: a, label: ASSIGNEE_LABELS[a] })),
  );
  const OFFICES = $derived(boardSettings.enabled.map((o) => ({ value: o, label: boardSettings.label(o) })));
  const START = [
    { value: 'now', label: 'Mit dem Beschluss' },
    { value: 'after', label: 'Wenn die vorige erledigt ist' },
  ] as const;

  const automatic = $derived(!!draft && AUTOMATIC_FOLLOW_UPS.includes(draft.kind));
  const titleError = $derived(
    submitted && draft && (!draft.title.trim() || draft.title.trim().length > RULE_LIMITS.title)
      ? `Titel mit 1 bis ${RULE_LIMITS.title} Zeichen.`
      : undefined,
  );
  const problem = $derived(submitted && draft ? followUpProblem(draft, namesMember) : null);

  /** Puts a placeholder where the cursor stands in the title. */
  function insert(placeholder: string) {
    if (!draft) return;
    const at = titleInput?.selectionStart ?? draft.title.length;
    draft.title = draft.title.slice(0, at) + placeholder + draft.title.slice(titleInput?.selectionEnd ?? at);
    queueMicrotask(() => {
      titleInput?.focus();
      titleInput?.setSelectionRange(at + placeholder.length, at + placeholder.length);
    });
  }

  /** No form of its own: the dialog sits inside the decision's form. */
  function apply() {
    submitted = true;
    if (!draft || titleError || followUpProblem(draft, namesMember)) return;
    onapply({ ...draft, office: draft.assignTo === 'OFFICE' ? draft.office : null });
  }
</script>

<Dialog open={!!followUp} title={isNew ? 'Neue Folgeaufgabe' : `Folgeaufgabe ${position}`} {onclose} wide>
  {#if draft}
    <div class="stack">
      <section class="stack part">
        <h4>Was</h4>
        <Field label="Titel der Aufgabe" error={titleError}>
          <input bind:this={titleInput} bind:value={draft.title} maxlength={RULE_LIMITS.title} required />
        </Field>
        <div class="row chips">
          <span class="muted small">Einsetzen:</span>
          {#each PLACEHOLDERS as p (p.value)}
            <Button size="sm" variant="ghost" tooltip={p.hint} onclick={() => insert(p.value)}>{p.value}</Button>
          {/each}
        </div>
        {#if kinds.length > 1}
          <Field label="Art" hint={automatic ? 'Erledigt sich von selbst, sobald es eingetragen ist.' : undefined}>
            <Select bind:value={draft.kind} options={kinds} aria-label="Art der Folgeaufgabe" />
          </Field>
        {:else if automatic}
          <p class="muted small">{FOLLOW_UP_KIND_LABELS[draft.kind]}</p>
        {/if}
      </section>

      <section class="stack part">
        <h4>Wer</h4>
        <ChoiceGroup
          name="follow-up-who"
          label="Wer erledigt sie"
          options={WHO}
          bind:value={() => draft!.assignTo, (v) => v && (draft!.assignTo = v)}
        />
        {#if draft.assignTo === 'OFFICE'}
          <Field label="Funktion" hint="Wer sie gerade innehat; solange niemand, der Vorstand.">
            <Select
              options={OFFICES}
              placeholder="Funktion wählen"
              bind:value={() => draft!.office ?? '', (v) => (draft!.office = v || null)}
              aria-label="Funktion"
            />
          </Field>
        {:else if draft.assignTo === 'DEFAULT'}
          <p class="muted small">Die im Beschluss Beauftragten; sonst die anwesenden Admins und Vorstandsmitglieder, sonst der Vorstand.</p>
        {/if}
      </section>

      <section class="stack part">
        <h4>Wann</h4>
        <div class="grid-2">
          <Field label="Startet">
            <ChoiceGroup
              name="follow-up-start"
              label="Startet"
              options={START}
              disabled={!canWait}
              bind:value={() => (draft!.afterPrevious && canWait ? 'after' : 'now'), (v) => (draft!.afterPrevious = v === 'after')}
            />
          </Field>
          <Field label="Fällig nach" hint={draft.afterPrevious ? 'Tagen ab dem Start' : 'Tagen ab dem Beschluss'}>
            <div class="row">
              <input
                type="number"
                min="0"
                max={RULE_LIMITS.dueDays}
                placeholder="ohne"
                class="short"
                aria-label="Fällig nach Tagen"
                bind:value={() => draft!.dueDays ?? '', (v) => (draft!.dueDays = v === '' || v == null ? null : Math.round(Number(v)))}
              />
              <span class="muted small">Tagen; leer = ohne Datum</span>
            </div>
          </Field>
        </div>
      </section>

      <section class="stack part">
        <h4>Details</h4>
        <Field label="Beschreibung (optional)" hint="Steht in der Aufgabe über dem Beschluss.">
          <textarea rows="3" maxlength={RULE_LIMITS.description} bind:value={() => draft!.description ?? '', (v) => (draft!.description = v || null)}
          ></textarea>
        </Field>
        <ListEditor bind:lines={draft.checklist} label="Checkliste" max={RULE_LIMITS.checklist} maxLength={RULE_LIMITS.item} />
      </section>

      {#if problem}<p class="error small" role="alert">{problem}</p>{/if}
      <div class="row between">
        <div>
          {#if !isNew}<Button variant="ghost" icon="delete" onclick={onremove}>Folgeaufgabe entfernen</Button>{/if}
        </div>
        <div class="row">
          <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
          <Button variant="primary" onclick={apply}>Übernehmen</Button>
        </div>
      </div>
    </div>
  {/if}
</Dialog>

<style>
  h4,
  p {
    margin: 0;
  }
  h4 {
    font-size: var(--font-size-small);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .part {
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }
  .chips {
    gap: var(--space-xs);
  }
  .short {
    width: 6rem;
  }
  .between {
    justify-content: space-between;
  }
  .error {
    color: var(--color-danger);
  }
</style>
