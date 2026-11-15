<script lang="ts">
  import { backStack, commands, bus, session } from '../../lib/container';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { invoiceActions } from './actions';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { settings } from '../../settings';
  import { FINANCE_CHANGED } from './events';
  import { moneyInput, parseMoney, type Invoice, type InvoiceInput } from './model';
  import { accounts, categories, financeApi, money } from './services';

  /**
   * One open invoice (`id` '-' = new): to pay (an expense category) or to collect (an income category). Who keeps the books gets it as a
   * task; paying books it on an account and finishes the task. Window only.
   */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  interface InvoiceForm {
    counterparty: string;
    text: string;
    amount: string;
    dueOn: string;
    category: string;
    note: string;
  }

  const limits = settings.finance;
  // svelte-ignore state_referenced_locally
  const isNew = id === '-';
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  const edit = new EditSession<InvoiceForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const create = isNew ? new CreateController(bus, handle, 'Neue Rechnung') : null;
  const write = new Action();
  // svelte-ignore state_referenced_locally
  const invoice = new Resource(() => financeApi.invoice(id));
  if (!isNew) void invoice.load();
  void accounts.load();
  void categories.load();
  view.title(() => invoice.value?.text);
  useBus(bus, FINANCE_CHANGED, () => {
    if (!isNew && !edit.editing && !write.busy) void invoice.load();
  });

  const blank = $state<InvoiceForm>({ counterparty: '', text: '', amount: '', dueOn: session.clock.today(), category: '', note: '' });
  const form = $derived(isNew ? blank : edit.form);
  let submitted = $state(false);
  const errors = $derived({
    counterparty: !form?.counterparty.trim() ? 'Von wem oder an wen angeben.' : null,
    text: !form?.text.trim() ? 'Einen Text angeben.' : null,
    amount: !(parseMoney(form?.amount ?? '') ?? 0) ? 'Einen Betrag über 0 angeben, z. B. 120,50.' : null,
    dueOn: !form?.dueOn ? 'Ein Fälligkeitsdatum angeben.' : null,
    category: !form?.category ? 'Eine Kategorie wählen.' : null,
  });
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
    },
    get valid() {
      return Object.values(errors).every((e) => !e);
    },
  };
  const error = (field: keyof typeof errors) => (submitted ? errors[field] : null);

  const input = (f: InvoiceForm): InvoiceInput => ({
    counterparty: f.counterparty.trim(),
    text: f.text.trim(),
    amountCents: parseMoney(f.amount) ?? 0,
    dueOn: f.dueOn,
    category: f.category,
    note: f.note.trim() || null,
  });
  const categoryOptions = (kept: string | null) => [
    { value: '', label: 'Kategorie wählen' },
    ...categories.items
      .filter((c) => !c.archived || c.key === kept)
      .map((c) => ({ value: c.key, label: `${c.label} (${c.direction === 'IN' ? 'zu bekommen' : 'zu bezahlen'})` })),
  ];
  const incoming = (i: Invoice) => categories.get(i.category)?.direction === 'IN';

  async function submit() {
    if (isNew) await create!.submit(async () => (await financeApi.saveInvoice(null, input(blank))).id, 'invoice', 'Rechnung angelegt.');
    else await edit.submit(async (f) => invoice.set(await financeApi.saveInvoice(id, input(f))), 'Rechnung gespeichert.');
  }

  // The pay form: account and day of the booking.
  let paying = $state(false);
  let payAccount = $state('');
  let paidOn = $state(session.clock.today());
  backStack.while(
    () => paying,
    () => (paying = false),
  );
  const pay = {
    submitted: false,
    get valid() {
      return !!payAccount && !!paidOn;
    },
  };
  async function submitPay() {
    if (await view.attempt(write, () => write.run(async () => invoice.set(await financeApi.payInvoice(id, payAccount, paidOn))))) {
      paying = false;
      view.notify('Gebucht; die Aufgabe ist erledigt.');
    }
  }

  const act = useRecordActions(
    commands,
    invoiceActions,
    () => (isNew || edit.form || paying ? null : invoice.value),
    () => view.leave(),
    () => invoice.load(),
  );
  const startEdit = (i: Invoice) =>
    edit.edit({
      counterparty: i.counterparty,
      text: i.text,
      amount: moneyInput(i.amountCents),
      dueOn: i.dueOn,
      category: i.category,
      note: i.note ?? '',
    });
  useCommands(commands, {
    'record.edit': { run: () => invoice.value && startEdit(invoice.value), when: () => act.has('record.edit') },
    'invoice.pay': { run: () => (paying = true), when: () => act.has('invoice.pay') },
  });
</script>

{#snippet editor(f: InvoiceForm, kept: string | null)}
  <EditorForm
    action={create?.save ?? edit.save}
    submitLabel={isNew ? 'Anlegen' : 'Speichern'}
    oncancel={() => (isNew ? handle.close() : edit.cancel())}
    onsubmit={submit}
    validate={check}
  >
    <Field label="Kategorie" error={error('category')} hint="Ausgabe = wir bezahlen, Einnahme = wir bekommen das Geld.">
      <Select bind:value={f.category} options={categoryOptions(kept)} />
    </Field>
    <div class="grid-2">
      <Field label="Von / an" error={error('counterparty')}><input bind:value={f.counterparty} maxlength="120" required /></Field>
      <Field label="Betrag" error={error('amount')}><input bind:value={f.amount} inputmode="decimal" placeholder="0,00" required /></Field>
    </div>
    <div class="grid-2">
      <Field label="Text" error={error('text')}><input bind:value={f.text} maxlength={limits.textMaxLength} required /></Field>
      <Field label="Fällig am" error={error('dueOn')}><DateInput bind:value={f.dueOn} required /></Field>
    </div>
    <Field label="Notiz (optional)"><textarea bind:value={f.note} rows="3" maxlength={limits.noteMaxLength}></textarea></Field>
  </EditorForm>
{/snippet}

{#if isNew}
  <Detail title="Neue Rechnung">{@render editor(blank, null)}</Detail>
{:else}
  <AsyncView resource={invoice}>
    {#snippet children(i)}
      <Detail title={edit.form ? 'Rechnung bearbeiten' : i.text}>
        {#snippet meta()}
          {#if !edit.form}
            {#if i.bookingId}<Tag tone="green">{incoming(i) ? 'Bezahlt erhalten' : 'Bezahlt'}</Tag>
            {:else if i.dueOn < session.clock.today()}<Tag tone="red">Überfällig</Tag>
            {:else}<Tag tone="blue">Offen</Tag>{/if}
          {/if}
        {/snippet}
        {#snippet actions()}
          <RecordActionButtons actions={act} />
        {/snippet}

        {#if form}
          {@render editor(form, i.category)}
        {:else if paying}
          <EditorForm action={write} submitLabel="Buchen" oncancel={() => (paying = false)} onsubmit={submitPay} validate={pay}>
            <p class="muted small">
              {incoming(i) ? 'Eine Einnahme' : 'Eine Ausgabe'} über {money(i.amountCents)} in „{categories.label(i.category)}“.
            </p>
            <div class="grid-2">
              <Field label="Konto">
                <Select bind:value={payAccount} options={[{ value: '', label: 'Konto wählen' }, ...accounts.options()]} />
              </Field>
              <Field label="Bezahlt am"><DateInput bind:value={paidOn} required /></Field>
            </div>
          </EditorForm>
        {:else}
          <dl class="props">
            <dt>{incoming(i) ? 'Von' : 'An'}</dt>
            <dd>{i.counterparty}</dd>
            <dt>Betrag</dt>
            <dd>{money(i.amountCents)}</dd>
            <dt>Kategorie</dt>
            <dd>{categories.label(i.category)}</dd>
            <dt>Fällig am</dt>
            <dd>{session.format.date(i.dueOn)}</dd>
            {#if i.bookingId}
              <dt>Buchung</dt>
              <dd><RecordLink kind="booking" id={i.bookingId}>Zur Buchung</RecordLink></dd>
            {/if}
            {#if i.taskId}
              <dt>Aufgabe</dt>
              <dd><RecordLink kind="task" id={i.taskId}>Zur Aufgabe</RecordLink></dd>
            {/if}
            <dt>Angelegt</dt>
            <dd>
              {session.format.dateTime(i.createdAt)}{#if i.createdBy}, <MemberName memberId={i.createdBy} />{/if}
            </dd>
          </dl>
          {#if i.note}<p class="prose">{i.note}</p>{/if}
        {/if}
      </Detail>
    {/snippet}
  </AsyncView>
{/if}
