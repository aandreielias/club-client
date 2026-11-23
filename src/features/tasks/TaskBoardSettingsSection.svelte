<script lang="ts">
  import InfoTip from '../../ui/InfoTip.svelte';
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { statusLabel } from './model';
  import { taskLabels, taskStages } from './services';

  /** Statuses and labels on Einstellungen › Aufgaben-Regeln (admin/board): the order is dragged; each entry opens in the window. */
  const load = new Action();
  const reload = () => void load.run(() => Promise.all([taskStages.load(), taskLabels.load()]));
  reload();

  const stageRows = $derived(
    taskStages.items.map((s) => ({
      key: s.key,
      label: s.label,
      hue: s.hue,
      archived: s.archived,
      inUse: s.inUse,
      detail: `Phase ${statusLabel(s.phase)}`,
    })),
  );
  const labelRows = $derived(
    taskLabels.items.map((l) => ({ key: l.key, label: l.label, hue: l.hue, archived: l.archived, inUse: l.inUse, detail: '' })),
  );
</script>

<div class="stack">
  <h2>
    Status&nbsp;<InfoTip
      text="Die Spalten der Aufgaben-Tafel. Jeder Status gehört zu einer Phase (Offen, In Arbeit, Erledigt); jede Phase behält mindestens einen aktiven Status."
    />
  </h2>
  <SettingsList
    rows={stageRows}
    kind="task-stage"
    newLabel="Neuer Status"
    onremove={(row) => removeRecord(bus, row, 'Status', taskStages.ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Status', taskStages.ops(row.key))}
    onreorder={(keys) => load.run(() => taskStages.reorder(keys))}
    loading={load.busy && !taskStages.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Status."
  />
  <h2>Labels&nbsp;<InfoTip text="Schlagwörter zum Filtern von Aufgaben. Verwendete werden archiviert statt gelöscht." /></h2>
  <SettingsList
    rows={labelRows}
    kind="task-label"
    newLabel="Neues Label"
    onremove={(row) => removeRecord(bus, row, 'Label', taskLabels.ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Label', taskLabels.ops(row.key))}
    onreorder={(keys) => load.run(() => taskLabels.reorder(keys))}
    loading={load.busy && !taskLabels.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Labels."
  />
</div>

<style>
  h2 {
    margin: 0;
  }
</style>
