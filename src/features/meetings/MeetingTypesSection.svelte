<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { noticeText } from './model';
  import { meetingTypes } from './services';

  /** Einstellungen › Sitzungsarten (admin/board): the club's meeting types; each opens in the window, the order is dragged. */
  const load = new Action();
  const reload = () => void load.run(() => meetingTypes.load());
  reload();

  const rows = $derived(
    meetingTypes.items.map((t) => ({
      key: t.key,
      label: t.label,
      archived: t.archived,
      inUse: t.inUse,
      detail: `${t.electorate === 'ASSEMBLY' ? 'Mitglieder' : 'Vorstand'} · Frist ${noticeText(t.noticeHours)}${t.dueBy ? ' · jährlich' : ''}`,
    })),
  );
</script>

<div class="stack">
  <p class="muted">
    Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung
    beschlussfähig ist und was sie beschließen darf.
  </p>
  <SettingsList
    {rows}
    kind="meeting-type"
    newLabel="Neue Sitzungsart"
    onremove={(row) => removeRecord(bus, row, 'Sitzungsart', meetingTypes.ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Sitzungsart', meetingTypes.ops(row.key))}
    onreorder={(keys) => load.run(() => meetingTypes.reorder(keys))}
    loading={load.busy && !meetingTypes.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Sitzungsarten."
  />
</div>

<style>
  p {
    margin: 0;
  }
</style>
