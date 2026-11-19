<script lang="ts">
  import { settings } from '../../settings';
  import EditorForm from '../../ui/EditorForm.svelte';
  import type { Action } from '../../lib/state/Action.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';
  import { type OfficeSettingForm } from './OfficeSettingForm.svelte';
  import { boardSettings } from './services';

  /** Form of one office: its name, whether the club fills it, how many hold it, the term and the offices one person may hold with it. */
  let {
    form,
    action,
    submitLabel = 'Speichern',
    oncancel,
    onsubmit,
  }: { form: OfficeSettingForm; action: Action; submitLabel?: string; oncancel: () => void; onsubmit: () => void } = $props();

  const DUTIES = [
    { value: 'NONE', label: 'Keine besondere' },
    { value: 'CHAIR', label: 'Wie der Vorsitz (Protokoll freigeben)' },
    { value: 'SECRETARY', label: 'Wie die Schriftführung (Protokoll, Aufgaben)' },
  ] as const;
  const FINANCE = [
    { value: 'NONE', label: 'Kein Zugang' },
    { value: 'READ', label: 'Lesen' },
    { value: 'AUDIT', label: 'Lesen und prüfen' },
    { value: 'WRITE', label: 'Buchen' },
  ] as const;
  const BOARD = [
    { value: 'on', label: 'Gehört zum Vorstand' },
    { value: 'off', label: 'Außerhalb des Vorstands' },
  ] as const;
  const USE = [
    { value: 'on', label: 'Wird besetzt' },
    { value: 'off', label: 'Nicht besetzt' },
  ] as const;
  // The board-wide Buchhaltung settings (Einstellungen › Vorstand) decide what holding a board office adds.
  const boardReads = $derived(boardSettings.value?.boardFinance === 'READ');
  const boardHint = $derived(
    `Wer eine Funktion im Vorstand innehat, bekommt die Vorstandsrolle und zählt zur Größe des Vorstands. In der Buchhaltung ${boardReads ? 'liest der Vorstand mit' : 'sieht der Vorstand nichts'} (Einstellung unter Vorstand).`,
  );
  const financeHint = $derived(
    'Was wer diese Funktion innehat in der Buchhaltung tun darf; „Lesen und prüfen“ bestätigt Kassenprüfungen' +
      (boardSettings.value?.adminsConfirmAudit ? ', das dürfen auch Admins.' : '.') +
      (form.board && boardReads ? ' Als Vorstand liest sie ohnehin mit.' : ''),
  );
  const others = $derived(
    (boardSettings.value?.offices ?? []).filter((o) => o.enabled && o.office !== form.office).map((o) => ({ value: o.office, label: o.label })),
  );
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <Field label="Bezeichnung" hint="So heißt die Funktion überall in der App und in Einladungen." error={form.error('label')}>
    <input bind:value={form.label} maxlength={settings.members.office.labelMaxLength} required />
  </Field>
  {#if !form.isNew}
    <Field
      label="In Verwendung"
      hint={form.fixed ? 'Den Vorsitz hat jeder Verein.' : 'Nicht besetzte Funktionen werden nicht mehr vergeben; laufende enden nicht.'}
    >
      <ChoiceGroup
        name="office-use"
        label="In Verwendung"
        options={USE}
        disabled={form.fixed}
        bind:value={() => (form.enabled ? 'on' : 'off'), (v) => (form.enabled = v !== 'off')}
      />
    </Field>
  {/if}
  <Field group label="Vorstand" hint={boardHint}>
    <ChoiceGroup
      name="office-board"
      label="Vorstand"
      options={BOARD}
      bind:value={() => (form.board ? 'on' : 'off'), (v) => (form.board = v === 'on')}
    />
  </Field>
  <Field group label="In Sitzungen" hint="Wer diese Funktion innehat, übernimmt diese Aufgaben in Sitzungen.">
    <ChoiceGroup name="office-duty" label="In Sitzungen" options={DUTIES} bind:value={form.duty} />
  </Field>
  <Field group label="Buchhaltung" hint={financeHint}>
    <ChoiceGroup name="office-finance" label="Buchhaltung" options={FINANCE} bind:value={form.finance} />
  </Field>
  {#if form.enabled}
    <div class="grid-2">
      <Field label="Personen mindestens" hint="Weniger zeigt einen Hinweis auf der Vorstandsseite." error={form.error('holders')}>
        <input type="number" min="0" max={settings.members.office.maxHolders} bind:value={form.minHolders} class="short" />
      </Field>
      <Field label="Personen höchstens" hint="Leer: beliebig viele.">
        <input
          type="number"
          min="1"
          max={settings.members.office.maxHolders}
          placeholder="beliebig"
          class="short"
          bind:value={() => form.maxHolders ?? '', (v) => (form.maxHolders = v === '' || v == null ? null : Math.round(Number(v)))}
        />
      </Field>
    </div>
    <Field label="Funktionsperiode" hint="Jahre" error={form.error('termYears')}>
      <input type="number" min="1" max={settings.members.office.maxTermYears} bind:value={form.termYears} class="short" />
    </Field>
    {#if !form.isNew}
      <Field group label="Zugleich mit" hint="Funktionen, die eine Person zusätzlich innehaben darf. Gilt in beide Richtungen.">
        {#if others.length}
          <OptionList label="Zugleich mit" options={others} bind:value={form.partners} />
        {:else}
          <p class="muted small">Keine anderen Funktionen in Verwendung.</p>
        {/if}
      </Field>
    {/if}
  {/if}
</EditorForm>

<style>
  p {
    margin: 0;
  }
</style>
