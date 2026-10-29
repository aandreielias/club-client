<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { saveOrder } from '../../lib/detail/saveOrder';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { noticeText } from './model';
  import { meetingsApi, meetingTypes } from './services';

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

  /** The order in the meeting pickers. */
  async function reorder(keys: string[]) {
    await load.run(async () => {
      await saveOrder(keys, meetingTypes.items, ({ key: k, inUse: _inUse, ...input }, sort) => meetingsApi.saveType(k, { ...input, sort }));
      await meetingTypes.load();
    });
  }

  function ops(key: string) {
    const { key: _key, inUse: _inUse, ...input } = meetingTypes.get(key)!;
    return {
      delete: () => meetingsApi.deleteType(key),
      archive: (archived: boolean) => meetingsApi.saveType(key, { ...input, archived }),
      reload: () => meetingTypes.load(),
    };
  }
</script>

<div class="stack section">
  <p class="muted">
    Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung
    beschlussfähig ist und was sie beschließen darf.
  </p>
  <SettingsList
    {rows}
    kind="meeting-type"
    newLabel="Neue Sitzungsart"
    onremove={(row) => removeRecord(bus, row, 'Sitzungsart', ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Sitzungsart', ops(row.key))}
    onreorder={reorder}
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
