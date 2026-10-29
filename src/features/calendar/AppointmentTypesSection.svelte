<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { saveOrder } from '../../lib/detail/saveOrder';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { appointmentTypes, calendarApi } from './services';

  /** Einstellungen › Termine (admin/board): the club's kinds of appointments; each opens in the window, the order is dragged. */
  const load = new Action();
  const reload = () => void load.run(() => appointmentTypes.load());
  reload();

  const rows = $derived(
    appointmentTypes.items.map((t) => ({
      key: t.key,
      label: t.label,
      hue: t.hue,
      archived: t.archived,
      inUse: t.inUse,
      detail: [t.rides && 'Fahrgemeinschaften', t.cabins && 'Kabinen'].filter(Boolean).join(' · ') || '—',
    })),
  );

  /** The order in the calendar's lists and pickers. */
  async function reorder(keys: string[]) {
    await load.run(async () => {
      await saveOrder(keys, appointmentTypes.items, ({ key: k, inUse: _inUse, ...input }, sort) => calendarApi.saveType(k, { ...input, sort }));
      await appointmentTypes.load();
    });
  }

  function ops(key: string) {
    const { key: _key, inUse: _inUse, ...input } = appointmentTypes.get(key)!;
    return {
      delete: () => calendarApi.deleteType(key),
      archive: (archived: boolean) => calendarApi.saveType(key, { ...input, archived }),
      reload: () => appointmentTypes.load(),
    };
  }
</script>

<div class="stack section">
  <p class="muted">
    Welche Arten von Terminen es gibt, in welcher Farbe sie im Kalender stehen und ob Fahrgemeinschaften und Kabinen angeboten werden.
  </p>
  <SettingsList
    {rows}
    kind="appointment-type"
    newLabel="Neue Terminart"
    onremove={(row) => removeRecord(bus, row, 'Terminart', ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Terminart', ops(row.key))}
    onreorder={reorder}
    loading={load.busy && !appointmentTypes.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Terminarten."
  />
</div>

<style>
  p {
    margin: 0;
  }
</style>
