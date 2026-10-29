<script lang="ts">
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import ListEditor from '../../ui/ListEditor.svelte';
  import Select from '../../ui/Select.svelte';
  import MemberChips from './MemberChips.svelte';
  import type { FollowUp, NewFollowUp, Person } from './model';
  import { RULE_LIMITS } from './ResolutionRuleForm.svelte';
  import { resolutionRules } from './services';

  /**
   * "Aufgabe hinzufügen" for a meeting or resolution: a template of the club's decisions fills it in; it can start once another open task
   * of the same meeting is done.
   */
  let {
    open,
    contextTitle,
    candidates,
    followUps,
    add,
    onclose,
  }: {
    open: boolean;
    /** Fills {beschluss} of a template: the resolution's or meeting's title. */
    contextTitle: string;
    candidates: readonly Person[];
    /** The existing follow-ups (open ones can come first). */
    followUps: readonly FollowUp[];
    add: (f: NewFollowUp) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  const action = new Action();
  let title = $state('');
  let assignees = $state<string[]>([]);
  let due = $state('');
  let description = $state('');
  let checklist = $state<string[]>([]);
  let waitsFor = $state('');
  let template = $state('');
  let submitted = $state(false);

  $effect(() => {
    if (!open) return;
    title = '';
    assignees = [];
    due = '';
    description = '';
    checklist = [];
    waitsFor = '';
    template = '';
    submitted = false;
    action.reset();
  });

  /** Every follow-up the club's decisions bring, by decision. */
  const templates = $derived(
    resolutionRules.value.items
      .filter((r) => r.enabled && r.action)
      .flatMap((r) => r.followUps.map((f, i) => ({ value: `${r.action}:${i}`, label: `${resolutionRules.label(r.action!)}: ${f.title}`, f }))),
  );
  const starts = $derived([
    { value: '', label: 'Sofort' },
    ...followUps.filter((f) => f.taskStatus !== 'DONE').map((f) => ({ value: f.id, label: `Wenn „${f.title}“ erledigt ist` })),
  ]);
  const titleError = $derived(
    submitted && (!title.trim() || title.trim().length > RULE_LIMITS.title) ? `Titel mit 1 bis ${RULE_LIMITS.title} Zeichen.` : undefined,
  );

  function useTemplate(value: string) {
    template = value;
    const f = templates.find((t) => t.value === value)?.f;
    if (!f) return;
    const fill = (t: string) => t.replaceAll('{beschluss}', contextTitle).replaceAll('{mitglied}', '').replaceAll('{funktion}', '').trim();
    title = fill(f.title);
    description = f.description ? fill(f.description) : '';
    checklist = f.checklist.map(fill);
    due = f.dueDays == null ? '' : session.clock.localDate(new Date(Date.now() + f.dueDays * 86_400_000).toISOString());
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    if (titleError) return;
    const followUp: NewFollowUp = {
      title: title.trim(),
      description: description.trim() || null,
      assigneeIds: assignees,
      dueAt: due ? session.clock.toInstant(`${due}T18:00`) : null,
      checklist: checklist.map((t) => t.trim()).filter(Boolean),
      waitsFor: waitsFor || null,
    };
    if (await action.run(() => add(followUp).then((ok) => ok || Promise.reject(new Error('Nicht gespeichert.'))))) onclose();
  }
</script>

<Dialog {open} title="Aufgabe hinzufügen" {onclose} wide>
  {#if open}
    <form class="stack" onsubmit={submit} novalidate>
      {#if templates.length}
        <Field label="Vorlage (optional)" hint="Aus den Folgeaufgaben der Beschlussarten; danach anpassbar.">
          <Select options={templates} placeholder="Ohne Vorlage" bind:value={() => template, useTemplate} aria-label="Vorlage" />
        </Field>
      {/if}
      <Field label="Aufgabe" error={titleError}>
        <input bind:value={title} maxlength={RULE_LIMITS.title} required />
      </Field>
      <MemberChips bind:value={assignees} {candidates} label="Verantwortlich" placeholder="Verantwortlich (leer = Vorstand)" />
      <div class="grid-2">
        <Field label="Startet">
          <Select options={starts} bind:value={waitsFor} aria-label="Startet" />
        </Field>
        <Field label="Fällig (optional)" hint={waitsFor ? 'Zählt ab dem Start: so viele Tage nach heute.' : undefined}>
          <DateInput bind:value={due} />
        </Field>
      </div>
      <Field label="Beschreibung (optional)">
        <textarea rows="3" maxlength={RULE_LIMITS.description} bind:value={description}></textarea>
      </Field>
      <ListEditor bind:lines={checklist} label="Checkliste" max={RULE_LIMITS.checklist} maxLength={RULE_LIMITS.item} />
      <ErrorNote error={action.error} />
      <div class="row end">
        <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
        <Button type="submit" variant="primary" busy={action.busy}>Aufgabe anlegen</Button>
      </div>
    </form>
  {/if}
</Dialog>

<style>
  .end {
    justify-content: flex-end;
  }
</style>
