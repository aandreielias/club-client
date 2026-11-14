<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import { settings } from '../../settings';
  import DateInput from '../../ui/DateInput.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import RefPicker from '../../ui/RefPicker.svelte';
  import Select from '../../ui/Select.svelte';
  import type { BookingForm } from './BookingForm.svelte';
  import { accounts, categories } from './services';

  /** Fields of a booking (date, account, category, amount, text, links) or of a transfer (from, to, amount, text). */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: BookingForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const limits = settings.finance;
  const pick = (label: string) => ({ value: '', label });
  const accountOptions = $derived([pick('Konto wählen'), ...accounts.options(form.original?.account ?? [])]);
  const categoryOptions = $derived([
    pick('Kategorie wählen'),
    ...categories.items
      .filter((c) => !c.archived || c.key === form.original?.category)
      .map((c) => ({ value: c.key, label: `${c.label} (${c.direction === 'IN' ? 'Einnahme' : 'Ausgabe'})` })),
  ]);
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <div class="grid-2">
    <Field label="Datum" error={form.error('bookedOn')}><DateInput bind:value={form.bookedOn} required /></Field>
    <Field
      label="Betrag"
      error={form.error('amount')}
      hint={form.transfer ? undefined : 'Ohne Vorzeichen; die Kategorie sagt, ob Einnahme oder Ausgabe.'}
    >
      <input bind:value={form.amount} inputmode="decimal" placeholder="0,00" required />
    </Field>
  </div>
  <div class="grid-2">
    <Field label={form.transfer ? 'Von Konto' : 'Konto'} error={form.error('account')}>
      <Select bind:value={form.account} options={accountOptions} />
    </Field>
    {#if form.transfer}
      <Field label="Auf Konto" error={form.error('to')}><Select bind:value={form.to} options={accountOptions} /></Field>
    {:else}
      <Field label="Kategorie" error={form.error('category')}><Select bind:value={form.category} options={categoryOptions} /></Field>
    {/if}
  </div>
  <Field label="Text" error={form.error('text')}>
    <input bind:value={form.text} maxlength={limits.textMaxLength} required />
  </Field>
  <Field label="Notiz (optional)" error={form.error('note')}>
    <textarea bind:value={form.note} rows="3" maxlength={limits.noteMaxLength}></textarea>
  </Field>
  {#if !form.transfer}<RefPicker form={form.refs} />{/if}
</EditorForm>
