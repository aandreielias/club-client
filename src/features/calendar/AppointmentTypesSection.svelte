<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { background } from '../../lib/state/background';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { appointmentTypes, calendarApi } from './services';

  /** Einstellungen › Termine (admin/board): the club's kinds of appointments; each opens in the window. */
  background(appointmentTypes.load());

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
  />
</div>

<style>
  p {
    margin: 0;
  }
</style>
