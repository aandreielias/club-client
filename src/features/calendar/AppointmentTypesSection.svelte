<script lang="ts">
  import SettingsList from '../../ui/SettingsList.svelte';
  import { appointmentTypes } from './services';

  /** Einstellungen › Termine (admin/board): the club's kinds of appointments; each opens in the window. */
  void appointmentTypes.load().catch(() => {});

  const rows = $derived(appointmentTypes.items.map((t) => ({
    key: t.key, label: t.label, hue: t.hue, archived: t.archived,
    detail: [t.rides && 'Fahrgemeinschaften', t.cabins && 'Kabinen'].filter(Boolean).join(' · ') || '—',
  })));
</script>

<div class="stack section">
  <p class="muted">Welche Arten von Terminen es gibt, in welcher Farbe sie im Kalender stehen und ob Fahrgemeinschaften und Kabinen angeboten werden.</p>
  <SettingsList {rows} kind="appointment-type" newLabel="Neue Terminart" />
</div>

<style>
  p {
    margin: 0;
  }
</style>
