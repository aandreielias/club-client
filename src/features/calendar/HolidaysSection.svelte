<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { Holiday } from './model';
  import { calendarApi } from './services';

  /** Einstellungen › Termine: the club's holidays; new weekly series skip them and the calendar shows them. */
  const holidays = new Resource(() => calendarApi.holidays());
  void holidays.load();
  const save = new Action();
  const today = session.clock.today();
  let name = $state('');
  let from = $state(today);
  let to = $state(today);

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim() || to < from) return;
    if (await save.run(() => calendarApi.saveHoliday(null, { name: name.trim(), from, to }))) {
      name = '';
      void holidays.load();
      bus.publish(TOAST, { text: 'Ferien eingetragen.' });
    }
  }

  async function remove(h: Holiday) {
    const ok = await bus.request(CONFIRM, {
      title: 'Ferien löschen',
      message: `„${h.name}“ löschen? Bestehende Termine bleiben.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok && (await save.run(() => calendarApi.deleteHoliday(h.id)))) void holidays.load();
  }
</script>

<section class="stack">
  <h2>Ferien und freie Tage</h2>
  <p class="muted small">
    Neue wöchentliche Serien lassen diese Tage aus; der Kalender zeigt sie allen. Bestehende Termine sagst du mit „Zeitraum absagen“ ab.
  </p>
  <AsyncView resource={holidays}>
    {#snippet children(items)}
      {#if items.length}
        <ul class="holidays">
          {#each items as h (h.id)}
            <li>
              <span><strong>{h.name}</strong> <span class="muted">{session.format.date(h.from)} – {session.format.date(h.to)}</span></span>
              <Button size="sm" variant="ghost" icon="delete" tooltip="„{h.name}“ löschen" onclick={() => remove(h)}>Löschen</Button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Noch keine Ferien eingetragen.</p>
      {/if}
    {/snippet}
  </AsyncView>
  <form class="row add" onsubmit={add}>
    <Field label="Name"><input bind:value={name} maxlength="80" placeholder="Herbstferien" required /></Field>
    <Field label="Von"><DateInput bind:value={from} /></Field>
    <Field label="Bis"><DateInput bind:value={to} min={from} /></Field>
    <Button type="submit" busy={save.busy} disabled={!name.trim() || to < from}>Ferien eintragen</Button>
  </form>
  <ErrorNote error={save.error} />
</section>

<style>
  p,
  h2 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
  }
  .holidays {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .holidays li {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
    justify-content: space-between;
  }
  .add {
    align-items: end;
    flex-wrap: wrap;
  }
</style>
