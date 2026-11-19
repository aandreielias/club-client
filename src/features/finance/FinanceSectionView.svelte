<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { menu, recordMenu } from '../../ui/contextMenu';
  import { tooltip } from '../../ui/tooltip';
  import BudgetSection from './BudgetSection.svelte';
  import FeesSection from './FeesSection.svelte';
  import { FINANCE_CHANGED } from './events';
  import { yearLabel, yearOf } from '../../lib/time/clubYear';
  import { FINANCE_SECTIONS } from './model';
  import { accounts, financeApi, financeMay, money } from './services';

  /**
   * One section of the Buchhaltung in the window: balances, open invoices, Kassenprüfungen, a fiscal year's budget (`budget:2026`) or a
   * season's fees (`fees:2026`). Entries open in the same window, with the way back.
   */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const [part, year] = id.split(':');
  const startMonth = part === 'budget' ? (session.club?.fiscalYearStartMonth ?? 1) : (session.club?.seasonStartMonth ?? 7);
  const season = Number(year) || yearOf(session.clock.today(), startMonth);
  const label = yearLabel(season, startMonth);
  $effect(() =>
    handle.setTitle(part === 'budget' || part === 'fees' ? `${FINANCE_SECTIONS[part]} ${label}` : (FINANCE_SECTIONS[part] ?? 'Buchhaltung')),
  );

  const audits = new Resource(() => financeApi.audits());
  const invoices = new Resource(() => financeApi.invoices());
  if (part === 'balances') void accounts.load();
  if (part === 'audits') void audits.load();
  if (part === 'invoices') void invoices.load();
  useBus(bus, FINANCE_CHANGED, () => {
    if (part === 'balances') void accounts.load();
    if (part === 'audits') void audits.load();
    if (part === 'invoices') void invoices.load();
  });
  const open = $derived(invoices.value?.items.filter((i) => !i.bookingId) ?? []);
  const shown = $derived(accounts.items.filter((a) => !a.archived || a.balanceCents !== 0));
</script>

{#if part === 'balances'}
  <Detail title={FINANCE_SECTIONS.balances}>
    <ul class="rows">
      {#each shown as account (account.key)}
        <li {@attach menu(() => recordMenu('finance-account', account.key))}>
          <button type="button" class="link-button" onclick={() => handle.open('finance-account', account.key)} {@attach tooltip('Konto öffnen')}
            >{account.label}</button
          >
          <strong class:negative={account.balanceCents < 0}>{money(account.balanceCents)}</strong>
        </li>
      {:else}
        <li class="muted">Noch keine Konten.</li>
      {/each}
    </ul>
  </Detail>
{:else if part === 'invoices'}
  <Detail title={FINANCE_SECTIONS.invoices}>
    {#snippet actions()}
      {#if financeMay('WRITE')}
        <Button icon="add" tooltip="Eine Rechnung zum Bezahlen oder Einholen; wird eine Aufgabe" onclick={() => handle.open('invoice-new', '-')}
          >Neue Rechnung</Button
        >
      {/if}
    {/snippet}
    {#if open.length}
      <ul class="rows">
        {#each open as invoice (invoice.id)}
          <li {@attach menu(() => recordMenu('invoice', invoice.id))}>
            <button type="button" class="link-button" onclick={() => handle.open('invoice', invoice.id)} {@attach tooltip('Rechnung öffnen')}
              >{invoice.counterparty}: {invoice.text}</button
            >
            <span class="muted small" class:negative={invoice.dueOn < session.clock.today()}>
              {money(invoice.amountCents)}, fällig {session.format.date(invoice.dueOn)}
            </span>
          </li>
        {/each}
      </ul>
    {:else if invoices.value}
      <p class="empty">Keine offenen Rechnungen.</p>
    {/if}
    <ErrorNote error={invoices.error} />
  </Detail>
{:else if part === 'audits'}
  <Detail title={FINANCE_SECTIONS.audits}>
    {#snippet actions()}
      {#if audits.value?.mayConfirm}
        <Button icon="add" tooltip="Buchungen bis zu einem Tag als geprüft bestätigen" onclick={() => handle.open('audit-new', '-')}
          >Prüfung bestätigen</Button
        >
      {/if}
    {/snippet}
    {#if audits.value?.items.length}
      <ul class="rows">
        {#each audits.value.items as audit (audit.id)}
          <li {@attach menu(() => recordMenu('audit', audit.id))}>
            <button type="button" class="link-button" onclick={() => handle.open('audit', audit.id)} {@attach tooltip('Prüfung und Bericht öffnen')}
              >{audit.title}</button
            >
          </li>
        {/each}
      </ul>
    {:else if audits.value}
      <p class="empty">Noch keine Kassenprüfung.</p>
    {/if}
    <ErrorNote error={audits.error} />
  </Detail>
{:else if part === 'budget'}
  <BudgetSection year={season} {label} />
{:else if part === 'fees'}
  <FeesSection {season} {label} {handle} />
{/if}

<style>
  .negative {
    color: var(--color-danger);
  }
  strong {
    font-variant-numeric: tabular-nums;
  }
</style>
