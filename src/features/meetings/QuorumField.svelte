<script lang="ts">
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { quorumLabel, quorumValid, type Quorum } from './model';

  /**
   * A quorum (server: MeetingsApi.Quorum): "mindestens" or "mehr als" a share of `of`, and optionally a headcount. 0/1 = anyone,
   * 1/1 = all; the wording below shows how it reads.
   */
  let { value = $bindable(), of, submitted = false }: { value: Quorum; of: string; submitted?: boolean } = $props();

  const MODES = [
    { value: 'atLeast', label: 'mindestens' },
    { value: 'moreThan', label: 'mehr als' },
  ] as const;
  const toNumber = (v: unknown): number => (v === '' || v == null ? NaN : Number(v));
</script>

<Field
  label="Beschlussfähig mit"
  hint={quorumValid(value) ? `Gelesen: ${quorumLabel(value)} ${of}` : undefined}
  error={submitted && !quorumValid(value) ? 'Anteil von 0/1 bis 1/1 (Nenner höchstens 100), „mehr als“ nicht bei allen.' : null}
>
  <div class="row">
    <Select
      bind:value={() => (value.moreThan ? 'moreThan' : 'atLeast'), (v) => (value = { ...value, moreThan: v === 'moreThan' })}
      options={MODES}
      aria-label="Mindestens oder mehr als"
    />
    <input
      type="number"
      min="0"
      max={value.denominator}
      class="short"
      aria-label="Zähler"
      bind:value={() => value.numerator, (v) => (value = { ...value, numerator: toNumber(v) })}
    />
    <span aria-hidden="true">/</span>
    <input
      type="number"
      min="1"
      max="100"
      class="short"
      aria-label="Nenner"
      bind:value={() => value.denominator, (v) => (value = { ...value, denominator: toNumber(v) })}
    />
    <span>{of}</span>
  </div>
</Field>
<Field label="Und mindestens (optional)" hint="So viele Anwesende braucht es auch bei kleinem Anteil; leer = keine Mindestzahl.">
  <div class="row">
    <input
      type="number"
      min="1"
      max="10000"
      class="short"
      aria-label="Mindestzahl"
      bind:value={() => value.minimum ?? '', (v) => (value = { ...value, minimum: v === '' || v == null ? null : Number(v) })}
    />
    <span>Personen</span>
  </div>
</Field>
