<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import HolidaysSection from './HolidaysSection.svelte';
  import { appointmentTypes } from './services';

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
</script>

<div class="stack">
  <p class="muted">
    Welche Arten von Terminen es gibt, in welcher Farbe sie im Kalender stehen und ob Fahrgemeinschaften und Kabinen angeboten werden.
  </p>
  <SettingsList
    {rows}
    kind="appointment-type"
    newLabel="Neue Terminart"
    onremove={(row) => removeRecord(bus, row, 'Terminart', appointmentTypes.ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Terminart', appointmentTypes.ops(row.key))}
    onreorder={(keys) => load.run(() => appointmentTypes.reorder(keys))}
    loading={load.busy && !appointmentTypes.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Terminarten."
  />
  <HolidaysSection />
</div>

<style>
  p {
    margin: 0;
  }
</style>
