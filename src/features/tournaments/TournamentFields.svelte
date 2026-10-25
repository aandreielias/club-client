<script lang="ts">
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';
  import { FORMAT_LABELS, type TournamentFormat } from './model';
  import { MAX_FIELDS, type TournamentForm } from './TournamentForm.svelte';

  /** The fields of a new or edited tournament; group settings, fields and format lock after the draw. */
  let { form }: { form: TournamentForm } = $props();

  let places = $state<Location[]>([]);
  locationsApi.list().then((list) => (places = list), () => {});
  const formats = (Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((value) => ({ value, label: FORMAT_LABELS[value] }));
  const numbers = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: String(from + i) }));

  const groupHint = $derived.by(() => {
    if (!form.settingsEditable) return 'Nach der Auslosung nicht mehr änderbar.';
    if (!form.schedule) return 'Jede Gruppe spielt jeder gegen jeden. Die Auswahl richtet sich nach den eingetragenen Teams.';
    return `${form.teamCount} Teams: ${form.schedule.matches} Gruppenspiele.`;
  });
  const fieldHint = $derived(
    form.schedule
      ? `Mindestens ${form.schedule.waves} ${form.schedule.waves === 1 ? 'Durchgang' : 'Durchgänge'} in der Gruppenphase.`
      : 'Die Auslosung verteilt die Spiele auf die Felder.',
  );
</script>

<Field label="Name" error={form.error('name')}><input bind:value={form.name} maxlength="120" placeholder="z. B. Herbstcup 2026" required /></Field>
<div class="grid-2">
  <Field label="Von" error={form.error('dates')}><DateInput bind:value={form.startsOn} required /></Field>
  <Field label="Bis"><DateInput bind:value={form.endsOn} min={form.startsOn} required /></Field>
</div>
<Field label="Ort (optional)">
  <Select bind:value={form.locationId} placeholder="Kein Ort" options={[{ value: '', label: 'Kein Ort' }, ...places.map((l) => ({ value: l.id, label: l.name }))]} />
</Field>
{#if !form.original}
  <Field label="Teams (optional)" error={form.error('teams')}
    hint={form.teamNames.length ? `${form.teamNames.length} Teams. Eigene Teams lassen sich danach im Reiter „Teams“ verknüpfen.` : 'Ein Team pro Zeile; geht auch später im Reiter „Teams“.'}>
    <textarea bind:value={form.teamsText} rows="6" placeholder={'SDG Damen 1\nUVC Graz\nTSV Seeblick'}></textarea>
  </Field>
{/if}
<fieldset class="stack" disabled={!form.settingsEditable}>
  <div class="grid-2">
    <Field label="Spielfelder" error={form.error('fields')} hint={fieldHint}>
      <Select bind:value={() => String(form.fieldCount), (v) => (form.fieldCount = Number(v))} options={numbers(1, MAX_FIELDS)} />
    </Field>
    <Field label="Gruppen" error={form.error('groups')} hint={groupHint}>
      <Select bind:value={() => String(form.groupCount), (v) => (form.groupCount = Number(v))}
        options={form.groupOptions.map((g) => ({ value: String(g), label: g === form.fieldCount ? `${g} (eine je Feld)` : String(g) }))} />
    </Field>
  </div>
  <Field label="Weiter je Gruppe" hint="{form.qualifiers} Teams in der KO-Runde.">
    <Select bind:value={() => String(form.advancePerGroup), (v) => (form.advancePerGroup = Number(v))} options={numbers(1, 4)} />
  </Field>
  <div class="format">
    <ChoiceGroup name="tournament-format" label="Spielart" options={formats} bind:value={form.format} />
    <p class="muted small">
      {#if form.format === 'VOLLEYBALL'}Teams zu 6. Sätze bis 25, Entscheidungssatz bis 15. Tabelle: 3:0 Punkte für einen klaren Sieg, 2:1 nach dem Entscheidungssatz.
      {:else if form.format === 'BEACH'}Zwei Gewinnsätze, Sätze bis 21, der dritte bis 15. Tabelle: 2 Punkte für einen Sieg, 1 für eine Niederlage.
      {:else}Nur wer gewinnt wird eingetragen, in der Gruppe auch Unentschieden. Tabelle: Sieg 3, Unentschieden 1, Niederlage 0.{/if}
    </p>
  </div>
  {#if form.format === 'VOLLEYBALL'}
    <Field label="Spiele">
      <Select bind:value={() => String(form.setsToWin), (v) => (form.setsToWin = Number(v))}
        options={[{ value: '2', label: 'Zwei Gewinnsätze (Best of 3)' }, { value: '3', label: 'Drei Gewinnsätze (Best of 5)' }]} />
    </Field>
  {:else if form.format === 'BEACH'}
    <Field label="Spieler:innen je Team">
      <Select bind:value={() => String(form.beachTeamSize), (v) => (form.beachTeamSize = Number(v))} options={numbers(2, 4)} />
    </Field>
  {/if}
</fieldset>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .format {
    display: grid;
    gap: var(--space-xs);
  }
  .format p {
    margin: 0;
  }
</style>
