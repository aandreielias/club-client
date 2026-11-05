<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { appointmentTypes } from './services';

  /** Einstellungen › Termine (admin/board): the club's kinds of appointments; each opens in the window, the order is dragged. */
  // Car pools for the whole club; the types below and each appointment switch them further.
  const rides = new SettingsDraft({ enabled: session.club!.ridesEnabled });
  async function saveRides(value: { enabled: boolean }) {
    await session.updateClub({ ridesEnabled: value.enabled });
    return { enabled: session.club!.ridesEnabled };
  }

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
  <SettingsForm title="Fahrgemeinschaften" draft={rides} onsave={saveRides}>
    <label class="check">
      <input type="checkbox" bind:checked={rides.value.enabled} /> Fahrgemeinschaften im Verein anbieten
    </label>
    <p class="muted small">Welche Terminarten sie anbieten, legst du unten fest; bei jedem Termin lassen sie sich zusätzlich ein- und ausschalten.</p>
  </SettingsForm>
  <h2>Terminarten</h2>
  <p class="muted small">
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
</div>

<style>
  p,
  h2 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
  }
</style>
