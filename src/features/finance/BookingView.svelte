<script lang="ts">
  import { backStack, commands, bus, session } from '../../lib/container';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { bookingActions } from './actions';
  import { APP_ERROR } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LinkedRecords from '../../ui/LinkedRecords.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { downloadLink } from '../../lib/window/openTab';
  import { tooltip } from '../../ui/tooltip';
  import { BookingForm } from './BookingForm.svelte';
  import BookingEditor from './BookingEditor.svelte';
  import { FINANCE_CHANGED } from './events';
  import type { Booking } from './model';
  import { accounts, categories, financeApi, financeMay, money } from './services';
  import { settings } from '../../settings';

  /**
   * One booking: who reads the books sees it; WRITE holders edit or delete it until it has a Storno or a Kassenprüfung covers it,
   * reverse it and keep its receipts. Window and page.
   */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<BookingForm>(bus, backStack);
  const write = new Action();
  // svelte-ignore state_referenced_locally
  const booking = new Resource(() => financeApi.booking(id));
  void booking.load();
  void accounts.load();
  void categories.load();
  view.title(() => booking.value?.text);
  useBus(bus, FINANCE_CHANGED, ({ data }) => {
    if ((data.bookingId === null || data.bookingId === id) && !edit.editing && !write.busy) void booking.load();
  });

  const writer = $derived(financeMay('WRITE'));
  const direction = (key: string) => categories.get(key)?.direction;
  let input = $state<HTMLInputElement>();

  async function submit() {
    await edit.submit(async (form) => booking.set(await financeApi.update(id, form.toInput())), 'Buchung gespeichert.');
  }

  /** A write whose answer is the booking; errors as a toast. */
  async function change(run: () => Promise<Booking>, success: string) {
    if (await view.attempt(write, () => write.run(async () => booking.set(await run())))) view.notify(success);
  }

  const act = useRecordActions(
    commands,
    bookingActions,
    () => (edit.form ? null : booking.value),
    () => view.leave(),
    () => booking.load(),
  );
  useCommands(commands, {
    'record.edit': {
      run: () => booking.value && edit.edit(BookingForm.edit(booking.value, direction)),
      when: () => !edit.form && !!booking.value && act.has('record.edit'),
    },
  });

  function picked() {
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (file) void change(() => financeApi.addReceipt(id, file), 'Beleg hinzugefügt.');
  }

  async function download(receipt: { fileId: string; name: string }) {
    try {
      await downloadLink(
        financeApi.receiptLink(id, receipt.fileId).then((l) => l.url),
        receipt.name,
      );
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }
</script>

<AsyncView resource={booking}>
  {#snippet children(b)}
    <Detail title={edit.form ? 'Buchung bearbeiten' : b.text}>
      {#snippet meta()}
        {#if !edit.form}
          {#if b.transferId}<Tag tone="blue">Umbuchung</Tag>{/if}
          {#if b.reversesId}<Tag tone="gray">Storno</Tag>{/if}
          {#if b.reversedBy}<Tag tone="red">Storniert</Tag>{/if}
          {#if b.locked}<Tag tone="green">Geprüft</Tag>{/if}
        {/if}
      {/snippet}
      {#snippet actions()}
        <RecordActionButtons actions={act} />
      {/snippet}

      {#if edit.form}
        <div class="editing" {@attach edit.track}>
          <BookingEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
        </div>
      {:else}
        <dl class="props">
          <dt>Betrag</dt>
          <dd class="amount" class:negative={b.amountCents < 0}>{money(b.amountCents)}</dd>
          <dt>Datum</dt>
          <dd>{session.format.date(b.bookedOn)}</dd>
          <dt>Konto</dt>
          <dd>{accounts.label(b.account)}</dd>
          {#if b.category}
            <dt>Kategorie</dt>
            <dd>{categories.label(b.category)}</dd>
          {:else if b.transferAccount}
            <dt>{b.amountCents < 0 ? 'Auf Konto' : 'Von Konto'}</dt>
            <dd>{accounts.label(b.transferAccount)}</dd>
          {/if}
          {#if b.reversesId}
            <dt>Storno von</dt>
            <dd>
              <button
                type="button"
                class="link-button"
                onclick={() => view.open('booking', b.reversesId!)}
                {@attach tooltip('Die stornierte Buchung öffnen')}>Buchung öffnen</button
              >
            </dd>
          {/if}
          {#if b.reversedBy}
            <dt>Storniert durch</dt>
            <dd>
              <button
                type="button"
                class="link-button"
                onclick={() => view.open('booking', b.reversedBy!)}
                {@attach tooltip('Die Gegenbuchung öffnen')}>Storno öffnen</button
              >
            </dd>
          {/if}
          <dt>Gebucht</dt>
          <dd>
            {session.format.dateTime(b.createdAt)}{#if b.createdBy}, <MemberName memberId={b.createdBy} />{/if}
          </dd>
        </dl>
        {#if b.note}<p class="prose">{b.note}</p>{/if}

        <SectionHeading title="Belege">
          {#snippet actions()}
            {#if writer && !b.locked && b.receipts.length < settings.finance.maxReceipts}
              <Button size="sm" variant="ghost" icon="upload" busy={write.busy} onclick={() => input?.click()}>Beleg hinzufügen</Button>
            {/if}
          {/snippet}
        </SectionHeading>
        <input bind:this={input} type="file" onchange={picked} hidden />
        {#if b.receipts.length}
          <ul class="rows">
            {#each b.receipts as receipt (receipt.fileId)}
              <li>
                <button
                  type="button"
                  class="link-button ellipsis"
                  onclick={() => download(receipt)}
                  {@attach tooltip(`${receipt.name} herunterladen`)}>{receipt.name}</button
                >
                {#if writer && !b.locked}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="delete"
                    tooltip="Beleg entfernen"
                    onclick={() => change(() => financeApi.removeReceipt(id, receipt.fileId), 'Beleg entfernt.')}
                  />
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">Kein Beleg.</p>
        {/if}

        {#if b.refs.length}
          <h2>Verknüpft</h2>
          <LinkedRecords refs={b.refs} />
        {/if}
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .editing {
    display: contents;
  }
  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .negative {
    color: var(--color-danger);
  }
</style>
