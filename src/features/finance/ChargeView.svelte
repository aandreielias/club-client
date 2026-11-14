<script lang="ts">
  import { backStack, bus, session } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { settings } from '../../settings';
  import { membershipKinds } from '../members/services';
  import { FINANCE_CHANGED } from './events';
  import { chargeStatus, moneyInput, parseMoney, seasonLabel, type Charge } from './model';
  import { accounts, financeApi, financeMay, money } from './services';

  /** One member's fee of a season: payments (each a booking), reducing or waiving with a note, deleting while unpaid. Window only. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  interface ChargeForm {
    amount: string;
    waived: boolean;
    note: string;
  }

  const startMonth = session.club?.seasonStartMonth ?? 7;
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  const edit = new EditSession<ChargeForm>(bus, backStack);
  const write = new Action();
  // svelte-ignore state_referenced_locally
  const charge = new Resource(() => financeApi.charge(id));
  void charge.load();
  void accounts.load();
  void membershipKinds.load();
  view.title(() => (charge.value ? `Beitrag ${seasonLabel(charge.value.season, startMonth)}` : undefined));
  useBus(bus, FINANCE_CHANGED, () => {
    if (!edit.editing && !write.busy) void charge.load();
  });

  const writer = $derived(financeMay('WRITE'));
  const open = (c: Charge) => c.amountCents - c.paidCents;
  const settled = (c: Charge) => c.status === 'PAID' || c.status === 'WAIVED';

  let submitted = $state(false);
  const amountError = $derived(edit.form && parseMoney(edit.form.amount) === null ? 'Einen Betrag angeben, z. B. 120,00.' : null);
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
    },
    get valid() {
      return !amountError;
    },
  };
  const submit = () =>
    edit.submit(
      async (f) => charge.set(await financeApi.adjustCharge(id, parseMoney(f.amount)!, f.waived, f.note.trim() || null)),
      'Beitrag gespeichert.',
    );

  function remove(c: Charge) {
    void view.confirm(
      { title: 'Beitrag löschen', message: `Der Beitrag von ${money(c.amountCents)} wird gelöscht.`, confirmLabel: 'Löschen', danger: true },
      async () => (await view.attempt(write, () => write.run(() => financeApi.deleteCharge(c.id)))) && (view.leave(), true),
      'Beitrag gelöscht.',
    );
  }

  async function remind() {
    if (await view.attempt(write, () => write.run(() => financeApi.remindCharge(id)))) view.notify('Erinnerung gesendet.');
  }

  // The pay form: account, day and amount (the open rest by default).
  let paying = $state(false);
  let payAccount = $state('');
  let paidOn = $state(session.clock.today());
  let payAmount = $state('');
  backStack.while(
    () => paying,
    () => (paying = false),
  );
  const payCents = $derived(parseMoney(payAmount) ?? 0);
  const pay = {
    submitted: false,
    get valid() {
      return !!payAccount && !!paidOn && payCents > 0;
    },
  };
  function startPay(c: Charge) {
    payAmount = moneyInput(open(c));
    paying = true;
  }
  async function submitPay() {
    if (await view.attempt(write, () => write.run(async () => charge.set(await financeApi.payCharge(id, payAccount, paidOn, payCents))))) {
      paying = false;
      view.notify('Zahlung gebucht.');
    }
  }
</script>

<AsyncView resource={charge}>
  {#snippet children(c)}
    <Detail title={edit.form ? 'Beitrag anpassen' : `Beitrag ${seasonLabel(c.season, startMonth)}`}>
      {#snippet meta()}
        {#if !edit.form}{@const tag = chargeStatus(c, session.clock.today())}<Tag tone={tag.tone}>{tag.label}</Tag>{/if}
      {/snippet}
      {#snippet actions()}
        {#if !edit.form && !paying && writer}
          {#if !settled(c)}
            <Button variant="primary" onclick={() => startPay(c)} tooltip="Eine Zahlung buchen, auch einen Teil">Zahlung</Button>
            <Button busy={write.busy} onclick={remind} tooltip="Dem Mitglied und seinen Erziehungsberechtigten jetzt eine Erinnerung schicken"
              >Erinnern</Button
            >
          {/if}
          <Button
            icon="edit"
            tooltip="Den Beitrag senken oder den Rest erlassen, mit Notiz"
            onclick={() => edit.edit({ amount: moneyInput(c.amountCents), waived: c.status === 'WAIVED', note: c.note ?? '' })}>Anpassen</Button
          >
          {#if !c.payments.length}
            <Button variant="danger" icon="delete" busy={write.busy} onclick={() => remove(c)}>Löschen</Button>
          {/if}
        {/if}
      {/snippet}

      {#if edit.form}
        <EditorForm action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} validate={check}>
          <Field
            label="Beitrag"
            error={submitted ? amountError : null}
            hint={c.paidCents ? `Nicht unter dem schon Bezahlten (${money(c.paidCents)}).` : undefined}
          >
            <input bind:value={edit.form.amount} inputmode="decimal" placeholder="0,00" class="short" required />
          </Field>
          <label class="check"><input type="checkbox" bind:checked={edit.form.waived} /> Den offenen Rest erlassen</label>
          <Field label="Notiz (optional)" hint="Sieht auch das Mitglied.">
            <textarea bind:value={edit.form.note} rows="3" maxlength={settings.finance.noteMaxLength}></textarea>
          </Field>
        </EditorForm>
      {:else if paying}
        <EditorForm action={write} submitLabel="Buchen" oncancel={() => (paying = false)} onsubmit={submitPay} validate={pay}>
          <p class="muted small">Offen sind {money(open(c))}. Jede Zahlung ist eine Einnahme-Buchung.</p>
          <div class="grid-2">
            <Field label="Konto">
              <Select bind:value={payAccount} options={[{ value: '', label: 'Konto wählen' }, ...accounts.options()]} />
            </Field>
            <Field label="Bezahlt am"><DateInput bind:value={paidOn} required /></Field>
          </div>
          <Field label="Betrag"><input bind:value={payAmount} inputmode="decimal" placeholder="0,00" class="short" required /></Field>
        </EditorForm>
      {:else}
        <dl class="props">
          <dt>Mitglied</dt>
          <dd><MemberName memberId={c.memberId} /></dd>
          <dt>Mitgliedsart</dt>
          <dd>{membershipKinds.label(c.kind)}</dd>
          <dt>Beitrag</dt>
          <dd>{money(c.amountCents)}</dd>
          <dt>Bezahlt</dt>
          <dd>{money(c.paidCents)}</dd>
          <dt>Fällig am</dt>
          <dd>{session.format.date(c.dueOn)}</dd>
        </dl>
        {#if c.note}<p class="prose">{c.note}</p>{/if}
        {#if c.payments.length}
          <h2>Zahlungen</h2>
          <ul class="rows">
            {#each c.payments as p (p.bookingId)}
              <li>
                <RecordLink kind="booking" id={p.bookingId}>{session.format.date(p.paidOn)}</RecordLink>
                <span class:struck={p.reversed}>{money(p.amountCents)}</span>
                {#if p.reversed}<Tag tone="gray">Storniert</Tag>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .struck {
    text-decoration: line-through;
  }
</style>
