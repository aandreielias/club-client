<script lang="ts">
  import { settings } from '../../settings';
  import { bus, directory, pendingDeletes, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { ListModel } from '../../lib/list/ListModel.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Page from '../../ui/Page.svelte';
  import Select from '../../ui/Select.svelte';
  import { AbsenceForm } from './AbsenceForm.svelte';
  import type { Absence } from './model';
  import { calendarApi } from './services';

  /**
   * Planned absences of the member (and their minors): appointments on those days count as "Nein"
   * until an answer is given. Reasons are visible to coaches and board only.
   */
  const today = session.clock.today();
  const form = new AbsenceForm(today);
  const save = new Action();
  const nameOf = (memberId: string) => (memberId === session.member.id ? 'Ich' : directory.nameOf(memberId));
  const who = [{ value: '', label: 'Mich' }, ...session.wardIds.map((id) => ({ value: id, label: directory.nameOf(id) }))];

  const list = new ListModel<Absence>({
    id: 'absences',
    load: () => calendarApi.absences(),
    defaultSort: { key: 'from', dir: 'asc' },
    columns: [
      { key: 'from', label: 'Von', value: (a) => a.from, format: (a) => session.format.date(a.from), width: '10rem' },
      { key: 'to', label: 'Bis', value: (a) => a.to, format: (a) => session.format.date(a.to), width: '10rem' },
      { key: 'member', label: 'Für', value: (a) => nameOf(a.memberId), width: '12rem', hideOnCompact: !session.wardIds.length },
      { key: 'reason', label: 'Grund', value: (a) => a.reason, sortable: false },
      { key: 'actions', label: '', value: () => null, sortable: false, width: '3rem', align: 'end' },
    ],
  });
  void list.load();
  if (session.wardIds.length) void directory.loadRosters();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    if (await save.run(() => calendarApi.addAbsence(form.toNew()))) {
      bus.publish(TOAST, { text: 'Abwesenheit eingetragen. Termine an diesen Tagen zählen als „Nein“.' });
      form.reason = '';
      form.submitted = false;
      void list.load();
    }
  }

  function remove(absence: Absence) {
    pendingDeletes.schedule({
      ids: [absence.id],
      text: 'Abwesenheit gelöscht.',
      commit: async () => {
        await calendarApi.deleteAbsence(absence.id);
        void list.load();
      },
    });
  }
</script>

<Page title="Abwesenheiten" back={{ href: '/calendar', label: 'Kalender' }}>
  <form class="stack readable" onsubmit={submit} novalidate {@attach autofocus}>
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
    <ErrorNote error={save.error} />
    <div><Button type="submit" variant="primary" icon="add" busy={save.busy}>Abwesenheit eintragen</Button></div>
  </form>

  <h2>Eingetragen</h2>
  <DataTable model={list} toolbar={false} rowKey={(a) => a.id} emptyText="Keine kommenden Abwesenheiten.">
    {#snippet cell(absence, column)}
      {#if column.key === 'actions'}
        <Button size="sm" variant="ghost" icon="delete" onclick={() => remove(absence)} tooltip="Abwesenheit löschen" />
      {:else if column.key === 'reason'}
        <span class="muted">{absence.reason ?? ''}</span>
      {:else}
        {list.display(absence, column)}
      {/if}
    {/snippet}
  </DataTable>
</Page>
