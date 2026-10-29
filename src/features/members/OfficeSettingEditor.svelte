<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';
  import { OFFICE_LIMITS, type OfficeSettingForm } from './OfficeSettingForm.svelte';
  import { boardSettings } from './services';

  /** Form of one office: its name, whether the club fills it, how many hold it, the term and the offices one person may hold with it. */
  let { form, action, oncancel, onsubmit }: { form: OfficeSettingForm; action: Action; oncancel: () => void; onsubmit: () => void } = $props();

  const USE = [
    { value: 'on', label: 'Wird besetzt' },
    { value: 'off', label: 'Nicht besetzt' },
  ] as const;
  const others = $derived(
    (boardSettings.value?.offices ?? []).filter((o) => o.enabled && o.office !== form.office).map((o) => ({ value: o.office, label: o.label })),
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  <Field label="Bezeichnung" hint="So heißt die Funktion überall in der App und in Einladungen." error={form.error('label')}>
    <input bind:value={form.label} maxlength={OFFICE_LIMITS.label} required />
  </Field>
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
  {#if form.enabled}
    <div class="grid-2">
      <Field label="Personen mindestens" hint="Weniger zeigt einen Hinweis auf der Vorstandsseite." error={form.error('holders')}>
        <input type="number" min="0" max={OFFICE_LIMITS.holders} bind:value={form.minHolders} class="short" />
      </Field>
      <Field label="Personen höchstens" hint="Leer: beliebig viele.">
        <input
          type="number"
          min="1"
          max={OFFICE_LIMITS.holders}
          placeholder="beliebig"
          class="short"
          bind:value={() => form.maxHolders ?? '', (v) => (form.maxHolders = v === '' || v == null ? null : Math.round(Number(v)))}
        />
      </Field>
    </div>
    <Field label="Funktionsperiode" hint="Jahre" error={form.error('termYears')}>
      <input type="number" min="1" max={OFFICE_LIMITS.termYears} bind:value={form.termYears} class="short" />
    </Field>
    <Field label="Zugleich mit" hint="Funktionen, die eine Person zusätzlich innehaben darf. Gilt in beide Richtungen.">
      {#if others.length}
        <OptionList label="Zugleich mit" options={others} bind:value={form.partners} />
      {:else}
        <p class="muted small">Keine anderen Funktionen in Verwendung.</p>
      {/if}
    </Field>
  {/if}
  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>Speichern</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>

<style>
  p {
    margin: 0;
  }
  .short {
    width: 6rem;
  }
</style>
