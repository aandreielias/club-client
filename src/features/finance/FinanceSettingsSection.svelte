<script lang="ts">
  import InfoTip from '../../ui/InfoTip.svelte';
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { accounts, categories, financeMay, money } from './services';

  /** Einstellungen › Verein › Buchhaltung › Konten und Kategorien: the order is dragged; each entry opens in the window. */
  const load = new Action();
  const reload = () => void load.run(() => Promise.all([accounts.load(), categories.load()]));
  reload();
  const writer = $derived(financeMay('WRITE'));

  const accountRows = $derived(
    accounts.items.map((a) => ({ key: a.key, label: a.label, archived: a.archived, inUse: a.inUse, detail: money(a.balanceCents) })),
  );
  const categoryRows = $derived(
    categories.items.map((c) => ({
      key: c.key,
      label: c.label,
      archived: c.archived,
      inUse: c.inUse,
      detail: c.direction === 'IN' ? 'Einnahme' : 'Ausgabe',
    })),
  );
</script>

<div class="stack">
  <h2>Konten&nbsp;<InfoTip text="Wo das Geld des Vereins liegt, etwa Bankkonto und Kassa. Mit Buchungen werden sie archiviert statt gelöscht." /></h2>
  <SettingsList
    rows={accountRows}
    kind="finance-account"
    newLabel={writer ? 'Neues Konto' : undefined}
    onremove={writer ? (row) => removeRecord(bus, row, 'Konto', accounts.ops(row.key)) : undefined}
    onrestore={writer ? (row) => restoreRecord(bus, 'Konto', accounts.ops(row.key)) : undefined}
    onreorder={writer ? (keys) => load.run(() => accounts.reorder(keys)) : undefined}
    loading={load.busy && !accounts.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Konten."
  />
  <h2>Kategorien&nbsp;<InfoTip text="Wofür Geld ein- oder ausgeht. Die Art (Einnahme oder Ausgabe) gibt jeder Buchung ihr Vorzeichen." /></h2>
  <SettingsList
    rows={categoryRows}
    kind="finance-category"
    newLabel={writer ? 'Neue Kategorie' : undefined}
    onremove={writer ? (row) => removeRecord(bus, row, 'Kategorie', categories.ops(row.key)) : undefined}
    onrestore={writer ? (row) => restoreRecord(bus, 'Kategorie', categories.ops(row.key)) : undefined}
    onreorder={writer ? (keys) => load.run(() => categories.reorder(keys)) : undefined}
    loading={load.busy && !categories.items.length}
    error={load.error}
    onretry={reload}
    emptyText="Noch keine Kategorien."
  />
</div>

<style>
  h2 {
    margin: 0;
  }
</style>
