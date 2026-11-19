<script lang="ts">
  import { bus, directory, session } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import Tag from '../../ui/Tag.svelte';
  import BankQr from './BankQr.svelte';
  import { FINANCE_CHANGED } from './events';
  import { yearLabel } from '../../lib/time/clubYear';
  import { chargeStatus } from './model';
  import { financeApi, financeMay, money } from './services';

  /**
   * Meine Beiträge: the member's fees and their wards' (server: GET /me/fees), with how to pay while something is open. With `memberId`
   * (profile) only that member's: Buchhaltung readers get them for every member, others for themselves and their wards. With `history`
   * every payment and the treasurer's note too. On the profile hidden while there are none.
   */
  let { memberId = null, history = false }: { memberId?: string | null; history?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  const reader = !!memberId && financeMay('READ');
  // svelte-ignore state_referenced_locally
  const fees = new Resource(async () => (reader ? { items: await financeApi.memberCharges(memberId!), instructions: null } : financeApi.myFees()));
  void fees.load();
  // Fee changes reach only who keeps the books; a member sees theirs on the next load.
  useBus(bus, FINANCE_CHANGED, () => void fees.load());
  const startMonth = session.club?.seasonStartMonth ?? 7;
  const today = session.clock.today();
  const shown = $derived((fees.value?.items ?? []).filter((c) => !memberId || c.memberId === memberId));
  const due = $derived(shown.some((c) => c.status === 'OPEN' || c.status === 'PARTIAL'));
  const others = $derived(shown.some((c) => c.memberId !== session.member.id));
</script>

{#if shown.length || (!memberId && fees.value)}
  <SectionHeading title={memberId ? 'Mitgliedsbeiträge' : 'Meine Beiträge'} />
  <ul class="rows">
    {#each shown as c (c.id)}
      <li>
        <span>
          {#if others && !memberId}{`${directory.nameOf(c.memberId)}, `}{/if}Saison {yearLabel(c.season, startMonth)}
        </span>
        <span class="row">
          <span class="muted small">
            {money(c.amountCents)}{#if c.status === 'OPEN' || c.status === 'PARTIAL'}, offen {money(c.amountCents - c.paidCents)} bis {session.format.date(
                c.dueOn,
              )}{/if}
          </span>
          <Tag tone={chargeStatus(c, today).tone}>{chargeStatus(c, today).label}</Tag>
          {#if c.payUrl}<a href={c.payUrl} target="_blank" rel="noopener noreferrer">Bezahlen</a>{/if}
        </span>
        {#if c.bankQr && !reader}<BankQr payload={c.bankQr} />{/if}
        {#if history && (c.payments.length || c.note)}
          <ul class="history muted small">
            {#each c.payments as p (p.bookingId)}
              <li class:struck={p.reversed}>{session.format.date(p.paidOn)}: {money(p.amountCents)} bezahlt{p.reversed ? ' (storniert)' : ''}</li>
            {/each}
            {#if c.note}<li>{c.note}</li>{/if}
          </ul>
        {/if}
      </li>
    {:else}
      <li class="muted">Kein Mitgliedsbeitrag vorgeschrieben.</li>
    {/each}
  </ul>
  {#if due && fees.value?.instructions}<p class="instructions small">{fees.value.instructions}</p>{/if}
{/if}

<style>
  .history {
    flex-basis: 100%;
    margin: 0;
    padding-left: var(--space-md);
  }
  .instructions {
    margin: var(--space-xs) 0 0;
    white-space: pre-line;
  }
  .struck {
    text-decoration: line-through;
  }
</style>
