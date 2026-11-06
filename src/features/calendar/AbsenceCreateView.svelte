<script lang="ts">
  import { settings } from '../../settings';
  import { bus, directory, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { AbsenceForm } from './AbsenceForm.svelte';
  import { ABSENCES_CHANGED } from './events';
  import { calendarApi } from './services';

  /** New absence for oneself or a minor; appointments on those days count as "Nein". Absences have no window of their own, so it closes. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const today = session.clock.today();
  const form = new AbsenceForm(today);
  const save = new Action();
  const who = [{ value: '', label: 'Mich' }, ...session.wardIds.map((id) => ({ value: id, label: directory.nameOf(id) }))];
  // svelte-ignore state_referenced_locally
  handle.setTitle('Abwesenheit eintragen');

  async function submit() {
    if (await save.run(() => calendarApi.addAbsence(form.toNew()))) {
      bus.publish(TOAST, { text: 'Abwesenheit eingetragen. Termine an diesen Tagen zählen als „Nein“.' });
      bus.publish(ABSENCES_CHANGED);
      handle.close();
    }
  }
</script>

<Detail title="Abwesenheit eintragen">
  <EditorForm action={save} submitLabel="Eintragen" validate={form} oncancel={() => handle.close()} onsubmit={submit}>
    <div class="grid-2">
      <Field label="Von"><DateInput bind:value={form.from} min={today} required /></Field>
      <Field label="Bis"><DateInput bind:value={form.to} min={form.from || today} required /></Field>
    </div>
    {#if who.length > 1}
      <Field label="Für"><Select bind:value={form.memberId} options={who} /></Field>
    {/if}
    <Field label="Grund (optional)" hint="Sehen nur Trainer:innen der Teams, Vorstand und Admins." error={form.error}>
      <input bind:value={form.reason} maxlength={settings.calendar.reasonMaxLength} placeholder="z. B. Urlaub, Verletzung" />
    </Field>
  </EditorForm>
</Detail>
