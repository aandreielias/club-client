<script lang="ts">
  import { bus, commands, directory, pendingDeletes, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { ListModel } from '../../lib/list/ListModel.svelte';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import { ABSENCES_CHANGED } from './events';
  import type { Absence } from './model';
  import { calendarApi } from './services';

  /**
   * Planned absences of the member (and their minors): appointments on those days count as "Nein"
   * until an answer is given. Reasons are visible to coaches and board only.
   */
  const nameOf = (memberId: string) => (memberId === session.member.id ? 'Ich' : directory.nameOf(memberId));

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

  useBus(bus, ABSENCES_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'absence-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create } });

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
  {#snippet actions()}
    <Button variant="primary" icon="add" onclick={create}>Abwesenheit eintragen</Button>
  {/snippet}
  <p class="muted small">Termine an diesen Tagen zählen als „Nein“, bis du anders antwortest.</p>
  <DataTable
    model={list}
    toolbar={false}
    rowKey={(a) => a.id}
    emptyText="Keine kommenden Abwesenheiten."
    emptyAction={{ label: 'Abwesenheit eintragen', icon: 'add', run: create }}
  >
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
