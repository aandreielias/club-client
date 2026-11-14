<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { financeApi, financeMay, money } from './services';

  /** The task of an open invoice: which one (for readers of the books). */
  let { invoiceId }: { invoiceId: string } = $props();

  // svelte-ignore state_referenced_locally
  const invoice = new Resource(() => financeApi.invoice(invoiceId));
  if (financeMay('READ')) void invoice.load();
</script>

{#if invoice.value}
  {@const i = invoice.value}
  <p class="source small">
    Zur Rechnung <RecordLink kind="invoice" id={i.id}>{i.counterparty}: {i.text}</RecordLink>, {money(i.amountCents)}{#if i.bookingId}, bezahlt{/if}
  </p>
{/if}

<style>
  .source {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
