<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { SET_PATTERN, type Appointment } from './model';
  import { calendarApi } from './services';

  /** Training plan (trainings) or opponent, home/away and sets (matches); everyone who sees it reads, who may edit it writes. */
  let { appointment, editable }: { appointment: Appointment; editable: boolean } = $props();

  // svelte-ignore state_referenced_locally
  const extras = new Resource(() => calendarApi.extras(appointment.id));
  void extras.load();
  const save = new Action();
  const isMatch = $derived(appointment.type === 'MATCH' || !!extras.value?.opponent || !!extras.value?.sets.length);

  let editing = $state(false);
  let content = $state('');
  let opponent = $state('');
  let home = $state<'home' | 'away' | ''>('');
  let sets = $state<string[]>([]);
  const PLACES = [
    { value: 'home', label: 'Heim' },
    { value: 'away', label: 'Auswärts' },
  ] as const;

  function edit() {
    const x = extras.value;
    content = x?.content ?? '';
    opponent = x?.opponent ?? '';
    home = x?.home == null ? '' : x.home ? 'home' : 'away';
    sets = [...(x?.sets ?? [])];
    editing = true;
  }

  const invalidSet = $derived(sets.some((s) => s.trim() && !SET_PATTERN.test(s.trim())));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (invalidSet) return;
    const saved = await save.attempt(() =>
      calendarApi.setExtras(appointment.id, {
        content: content.trim() || null,
        opponent: opponent.trim() || null,
        home: home === '' ? null : home === 'home',
        sets: sets.map((s) => s.trim()).filter(Boolean),
      }),
    );
    if (saved) {
      extras.set(saved);
      editing = false;
      bus.publish(TOAST, { text: 'Gespeichert.' });
    }
  }
</script>

{#if extras.value && (editing || editable || extras.value.content || extras.value.opponent || extras.value.sets.length)}
  <h2>{isMatch ? 'Spiel' : 'Trainingsinhalt'}</h2>
  {#if editing}
    <form class="stack" onsubmit={submit}>
      {#if isMatch}
        <div class="grid-2">
          <Field label="Gegner"><input bind:value={opponent} maxlength="80" /></Field>
          <Field label="Spielort" group><ChoiceGroup name="home" label="Spielort" options={PLACES} bind:value={home} /></Field>
        </div>
        <Field label="Sätze" hint="Unsere Punkte zuerst, etwa 25:20." error={invalidSet ? 'Sätze im Format 25:20 angeben.' : undefined}>
          <div class="sets">
            {#each sets as _, i (i)}
              <input bind:value={sets[i]} maxlength="5" class="set" aria-label="Satz {i + 1}" />
            {/each}
            {#if sets.length < 5}<Button size="sm" variant="ghost" icon="add" onclick={() => (sets = [...sets, ''])}>Satz</Button>{/if}
          </div>
        </Field>
      {/if}
      <Field label={isMatch ? 'Notizen' : 'Inhalt'} hint={isMatch ? undefined : 'Übungen, Schwerpunkte, was mitzubringen ist.'}>
        <textarea bind:value={content} rows="4" maxlength="4000"></textarea>
      </Field>
      <ErrorNote error={save.error} />
      <div class="row">
        <Button type="submit" variant="primary" busy={save.busy}>Speichern</Button>
        <Button variant="ghost" onclick={() => (editing = false)}>Abbrechen</Button>
      </div>
    </form>
  {:else}
    {@const x = extras.value}
    {#if isMatch && (x.opponent || x.sets.length)}
      <p>
        {#if x.opponent}{x.home === true ? 'Heim gegen' : x.home === false ? 'Auswärts bei' : 'Gegen'} {x.opponent}{/if}
        {#if x.sets.length}
          <span class="result">{x.setsWon}:{x.setsLost}</span>
          <Tag tone={x.won ? 'green' : 'red'}>{x.won ? 'Gewonnen' : 'Verloren'}</Tag>
          <span class="muted small">({x.sets.join(', ')})</span>
        {/if}
      </p>
    {/if}
    {#if x.content}<p class="prose text">{x.content}</p>{/if}
    {#if editable}<div><Button icon="edit" onclick={edit}>{isMatch ? 'Spiel bearbeiten' : 'Inhalt bearbeiten'}</Button></div>{/if}
  {/if}
{/if}

<style>
  p {
    margin: 0;
  }
  .text {
    white-space: pre-line;
  }
  .sets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    align-items: center;
  }
  .set {
    width: 5rem;
  }
  .result {
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
  }
</style>
