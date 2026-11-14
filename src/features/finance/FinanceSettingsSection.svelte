<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { FINANCE_CHANGED } from './events';
  import { FEE_PARTS } from './model';
  import { accounts, categories, financeApi, financeMay, money } from './services';

  /**
   * Einstellungen › Buchhaltung: the club's accounts and categories (the order is dragged) and, for WRITE holders, the fee settings;
   * each entry opens in the window.
   */
  const load = new Action();
  const reload = () => void load.run(() => Promise.all([accounts.load(), categories.load()]));
  reload();
  const writer = $derived(financeMay('WRITE'));

  const fees = new Resource(() => financeApi.feeSettings());
  if (financeMay('WRITE')) void fees.load();
  useBus(bus, FINANCE_CHANGED, () => {
    if (financeMay('WRITE')) void fees.load();
  });
  const feeRows = $derived.by(() => {
    const f = fees.value;
    const details: Record<string, string> = {
      due: f ? `${f.dueDays} Tage nach Saisonbeginn, ${f.remindDays ? `alle ${f.remindDays} Tage erinnert` : 'keine Erinnerung'}` : '',
      payment: f?.iban ? `QR-Code an ${f.holder}` : f?.instructions ? 'Nur Text, kein QR-Code' : 'Nichts angegeben',
    };
    return Object.entries(FEE_PARTS).map(([key, label]) => ({ key, label, detail: details[key], archived: false, inUse: false }));
  });

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
  <h2>Konten</h2>
  <p class="muted small">Wo das Geld des Vereins liegt, etwa Bankkonto und Kassa. Mit Buchungen werden sie archiviert statt gelöscht.</p>
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
  <h2>Kategorien</h2>
  <p class="muted small">Wofür Geld ein- oder ausgeht. Die Art (Einnahme oder Ausgabe) gibt jeder Buchung ihr Vorzeichen.</p>
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
  {#if writer}
    <h2>Mitgliedsbeiträge</h2>
    <p class="muted small">Wann Beiträge fällig sind und erinnert wird, und wie Mitglieder bezahlen.</p>
    <SettingsList rows={feeRows} kind="finance-fees" loading={fees.loading && !fees.value} error={fees.error} onretry={() => void fees.load()} />
  {/if}
</div>

<style>
  p,
  h2 {
    margin: 0;
  }
</style>
