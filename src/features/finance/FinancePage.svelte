<script lang="ts">
  import { recordMenu } from '../../ui/contextMenu';
  import { bus, commands, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { FINANCE_CHANGED } from './events';
  import { JournalListModel } from './JournalListModel.svelte';
  import { FINANCE_SECTIONS, seasonLabel, seasonOf, type ExportFormat } from './model';
  import { accounts, categories, financeApi, financeMay, money } from './services';

  /**
   * Buchhaltung: one row each for the balances, open invoices, Kassenprüfungen and the season's budget and fees (each opens in the window),
   * then the season's journal; WRITE holders book and transfer, every reader exports the season.
   */
  const startMonth = session.club?.seasonStartMonth ?? 7;
  const current = seasonOf(session.clock.today(), startMonth);
  const list = new JournalListModel(
    financeApi,
    current,
    startMonth,
    {
      account: (key) => accounts.label(key),
      category: (key) => categories.label(key),
      money,
      date: (day) => session.format.date(day),
      accounts: () => accounts.options(),
      categories: () => categories.options(),
    },
    store,
  );
  void list.load();
  void accounts.load();
  void categories.load();
  const audits = new Resource(() => financeApi.audits());
  void audits.load();
  const invoices = new Resource(() => financeApi.invoices());
  void invoices.load();
  const open = $derived(invoices.value?.items.filter((i) => !i.bookingId) ?? []);
  useBus(bus, FINANCE_CHANGED, () => {
    void list.load();
    void audits.load();
    void invoices.load();
  });

  const exporting = new Action();
  async function exportJournal(format: ExportFormat) {
    const season = list.filters.season ? Number(list.filters.season) : current;
    await exporting.run(async () => {
      const file = await financeApi.exportJournal(season, format);
      BrowserFile.save(file, `Journal ${seasonLabel(season, startMonth).replace('/', '-')}.${format.toLowerCase()}`);
    });
  }

  const writer = $derived(financeMay('WRITE'));
  const create = (id: 'booking' | 'transfer') => bus.publish(WINDOW_OPEN, { kind: 'booking-new', id });
  useCommands(commands, { 'page.new': { run: () => create('booking'), when: () => writer } });
  const season = $derived(list.filters.season ? Number(list.filters.season) : current);
  const shown = $derived(accounts.items.filter((a) => !a.archived || a.balanceCents !== 0));
  const overdue = $derived(open.filter((i) => i.dueOn < session.clock.today()).length);
  const rows = $derived.by(() => {
    const label = seasonLabel(season, startMonth);
    const details: Record<string, string> = {
      balances: shown.map((a) => `${a.label} ${money(a.balanceCents)}`).join(' · ') || 'Noch keine Konten',
      invoices: open.length ? `${open.length} offen${overdue ? `, ${overdue} überfällig` : ''}` : 'Keine offen',
      audits: audits.value?.items[0]?.title ?? 'Noch keine',
      budget: `Saison ${label}`,
      fees: `Saison ${label}`,
    };
    return Object.entries(FINANCE_SECTIONS).map(([part, title]) => ({
      key: part === 'budget' || part === 'fees' ? `${part}:${season}` : part,
      label: title,
      detail: details[part],
      archived: false,
      inUse: false,
    }));
  });
</script>

<Page title="Buchhaltung">
  {#snippet actions()}
    {#if writer}
      <Button onclick={() => create('transfer')}>Umbuchung</Button>
    {/if}
    <Button icon="download" busy={exporting.busy} tooltip="Journal der Saison als CSV herunterladen" onclick={() => exportJournal('CSV')}>CSV</Button>
    <Button icon="download" busy={exporting.busy} tooltip="Journal der Saison als Excel-Datei herunterladen" onclick={() => exportJournal('XLSX')}
      >Excel</Button
    >
    {#if writer}
      <Button variant="primary" icon="add" onclick={() => create('booking')}>Neue Buchung</Button>
    {/if}
  {/snippet}

  <SettingsList {rows} kind="finance-section" />
  <ErrorNote error={exporting.error ?? invoices.error ?? audits.error} />

  <DataTable
    model={list}
    rowKey={(b) => b.id}
    onopen={(b) => bus.publish(WINDOW_OPEN, { kind: 'booking', id: b.id })}
    menu={(b) => recordMenu('booking', b.id)}
    selected={windows.current?.kind === 'booking' ? windows.current.id : null}
    emptyText="Keine Buchungen in dieser Saison."
    emptyAction={writer ? { label: 'Neue Buchung', icon: 'add', run: () => create('booking') } : null}
  />
  {#if list.truncated}<p class="muted small">Die Saison hat mehr Buchungen, als hier stehen; die ältesten fehlen.</p>{/if}
</Page>
