<script lang="ts">
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { FEE_PARTS, type FeeSettings } from './model';
  import { categories, financeApi } from './services';

  /** One part of the fee settings (Einstellungen › Verein › Buchhaltung › Mitgliedsbeiträge, WRITE): when fees fall due and are reminded, or how members pay. */
  let { id }: { id: string } = $props();

  const fees = new SettingsDraft<FeeSettings>({
    category: 'FEES',
    dueDays: 30,
    remindDays: 14,
    instructions: null,
    holder: null,
    iban: null,
    bic: null,
  });
  const load = new Action();
  void load.run(async () => fees.load(await financeApi.feeSettings()));
  void categories.load();
  const incomeOptions = $derived(
    categories.items
      .filter((c) => c.direction === 'IN' && (!c.archived || c.key === fees.value.category))
      .map((c) => ({ value: c.key, label: c.label })),
  );
  const text = (value: string) => value.trim() || null;
</script>

<ErrorNote error={load.error} />
{#if id === 'due'}
  <SettingsForm
    title={FEE_PARTS.due}
    intro="Die Beiträge je Mitgliedsart legt der Kassier in der Buchhaltung für jede Saison fest. Wer nach der Fälligkeit noch offen hat, wird mit den Eltern erinnert."
    draft={fees}
    onsave={(value) => financeApi.saveFeeSettings(value)}
  >
    <Field label="Kategorie der Zahlungen"><Select bind:value={fees.value.category} options={incomeOptions} /></Field>
    <Field label="Fällig nach Saisonbeginn" hint="Tage, 0 bis {settings.finance.fee.maxDays}">
      <input type="number" min="0" max={settings.finance.fee.maxDays} bind:value={fees.value.dueDays} class="short" />
    </Field>
    <Field label="Erinnern alle" hint="Tage, solange nach der Fälligkeit etwas offen ist; 0 = keine Erinnerung">
      <input type="number" min="0" max={settings.finance.fee.maxDays} bind:value={fees.value.remindDays} class="short" />
    </Field>
  </SettingsForm>
{:else if id === 'payment'}
  <SettingsForm
    title={FEE_PARTS.payment}
    intro="Mitglieder und Eltern sehen das bei offenen Beiträgen. Mit Kontoinhaber und IBAN bekommt jeder offene Beitrag einen QR-Code mit Betrag und Verwendungszweck, den Banking-Apps lesen (nur in Euro)."
    draft={fees}
    onsave={(value) => financeApi.saveFeeSettings(value)}
  >
    <Field label="So wird bezahlt" hint="Etwa wann und wie überwiesen wird.">
      <textarea
        rows="3"
        maxlength={settings.finance.fee.instructionsMaxLength}
        value={fees.value.instructions ?? ''}
        oninput={(e) => (fees.value.instructions = text(e.currentTarget.value))}></textarea>
    </Field>
    <Field label="Kontoinhaber" hint="Höchstens {settings.finance.fee.holderMaxLength} Zeichen; leer = kein QR-Code">
      <input
        maxlength={settings.finance.fee.holderMaxLength}
        value={fees.value.holder ?? ''}
        oninput={(e) => (fees.value.holder = text(e.currentTarget.value))}
      />
    </Field>
    <div class="grid-2">
      <Field label="IBAN">
        <input value={fees.value.iban ?? ''} oninput={(e) => (fees.value.iban = text(e.currentTarget.value))} placeholder="AT.." />
      </Field>
      <Field label="BIC (optional)">
        <input value={fees.value.bic ?? ''} oninput={(e) => (fees.value.bic = text(e.currentTarget.value))} class="short" />
      </Field>
    </div>
  </SettingsForm>
{/if}
