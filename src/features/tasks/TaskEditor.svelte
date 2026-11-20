<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import { REPEAT_OPTIONS } from './model';
  import { settings } from '../../settings';
  import type { Action } from '../../lib/state/Action.svelte';
  import Field from '../../ui/Field.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Select from '../../ui/Select.svelte';
  import AssigneePicker from './AssigneePicker.svelte';
  import AudiencePicker from '../../ui/AudiencePicker.svelte';
  import ChecklistEditor from './ChecklistEditor.svelte';
  import { BOARD_ONLY, CLUB_WIDE, FOR_CHOSEN, type TaskForm } from './TaskForm.svelte';
  import { directory } from '../../lib/container';
  import { taskPolicy as policy } from './services';

  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: TaskForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const limits = settings.tasks;
  /** Team tasks and the board's own club tasks keep whom they are for; the others switch between the two choices. */
  const fixed = $derived(form.isEdit && (form.teamOrNull !== null || form.teamId === BOARD_ONLY));
  const teamOptions = $derived(
    form.teamOrNull && form.isEdit
      ? [{ value: form.teamId, label: directory.teamName(form.teamOrNull) ?? 'Team' }]
      : form.teamId === BOARD_ONLY
        ? [{ value: BOARD_ONLY, label: 'Nur Vorstand' }]
        : [
            ...(policy.canCreateClubWide() || form.teamId === CLUB_WIDE ? [{ value: CLUB_WIDE, label: 'Ganzer Verein' }] : []),
            ...(policy.canCreateForChosen() || form.forChosen ? [{ value: FOR_CHOSEN, label: 'Bestimmte Personen und Gruppen' }] : []),
          ],
  );
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <Field label="Titel" error={form.error('title')}>
    <input bind:value={form.title} maxlength={limits.titleMaxLength} required />
  </Field>

  <div class="grid-2">
    <Field
      label="Für"
      hint={fixed
        ? 'Lässt sich nach dem Anlegen nicht mehr ändern.'
        : 'Ganzer Verein: alle Mitglieder sehen sie. Eine einzelne Mannschaft allein ergibt eine Mannschaftsaufgabe.'}
    >
      <Select bind:value={form.teamId} options={teamOptions} disabled={fixed} />
    </Field>
    <Field label="Fällig am (optional)" error={form.error('dueAt')}>
      <DateTimeInput bind:value={form.due} />
    </Field>
  </div>
  {#if form.forChosen}
    <AudiencePicker
      value={form.audience}
      onchange={(v) => (form.audience = v)}
      error={form.error('audience')}
      hint="Wer eine der gewählten Rollen, Funktionen, Teams oder Mitgliedsarten hat oder genannt ist, sieht die Aufgabe und kann sie bekommen."
    />
  {/if}
  <Field label="Wiederholen" hint="Ist die Aufgabe erledigt, entsteht die nächste, fällig entsprechend später." error={form.error('repeat')}>
    <Select bind:value={form.repeat} options={REPEAT_OPTIONS} />
  </Field>

  <Field label="Beschreibung" error={form.error('description')}>
    <textarea bind:value={form.description} rows="4" maxlength={limits.descriptionMaxLength}></textarea>
  </Field>

  <AssigneePicker {form} error={form.error('assignees')} />

  <ChecklistEditor {form} error={form.error('checklist')} />
</EditorForm>
