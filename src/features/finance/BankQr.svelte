<script lang="ts">
  import { renderSVG } from 'uqr';
  import { money } from './services';

  /** The SEPA QR code (EPC "GiroCode") of an open fee, with its transfer data for typing it in by hand. */
  let { payload }: { payload: string } = $props();

  // EPC lines: BCD, 002, 1, SCT, BIC, holder, IBAN, EUR<amount>, purpose, reference, text
  const lines = $derived(payload.split('\n'));
  // Black on white in every theme, so banking apps read it; ECC M as the EPC format asks.
  const svg = $derived(renderSVG(payload, { ecc: 'M', border: 2, whiteColor: '#fff', blackColor: '#000' }));
</script>

<div class="bank-qr">
  <!-- Generated locally by uqr from the server's EPC text: only rects, no user markup. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <div class="code" role="img" aria-label="QR-Code für die Überweisung">{@html svg}</div>
  <dl class="props small">
    <dt>Empfänger</dt>
    <dd>{lines[5]}</dd>
    <dt>IBAN</dt>
    <dd>{lines[6]}</dd>
    {#if lines[4]}<dt>BIC</dt>
      <dd>{lines[4]}</dd>{/if}
    <dt>Betrag</dt>
    <dd>{money(Math.round(Number(lines[7].slice(3)) * 100))}</dd>
    <dt>Verwendungszweck</dt>
    <dd>{lines[10]}</dd>
  </dl>
</div>

<style>
  .bank-qr {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: center;
    flex-basis: 100%;
  }
  .code {
    width: 9rem;
    flex: none;
  }
  .code :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
