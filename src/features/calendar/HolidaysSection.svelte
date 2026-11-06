<script lang="ts">
  import { pendingDeletes, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { holidays } from './services';

  /** Einstellungen › Feiertage (admin/board): days without training; new weekly series skip them, the calendar shows them to all. */
  const load = new Action();
  const reload = () => void load.run(() => holidays.load());
  reload();

  const rows = $derived(
    holidays.items
      .filter((h) => !pendingDeletes.isHidden(h.id))
      .map((h) => ({
        key: h.id,
        label: h.name,
        detail: h.from === h.to ? session.format.date(h.from) : `${session.format.date(h.from)} – ${session.format.date(h.to)}`,
        archived: false,
        inUse: false,
      })),
  );
</script>

<div class="stack">
  <p class="muted small">
    Ferien und freie Tage. Neue wöchentliche Serien lassen diese Tage aus; der Kalender zeigt sie allen. Bestehende Termine sagst du im Kalender mit
    „Zeitraum absagen“ ab.
  </p>
  <SettingsList
    {rows}
    kind="holiday"
    newLabel="Neue Ferien"
    loading={load.busy && !holidays.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Ferien eingetragen."
  />
</div>

<style>
  p {
    margin: 0;
  }
</style>
