<script lang="ts">
  import { bus, permissions, session, store } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { ZonedClock } from '../../lib/time/ZonedClock';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { calendarApi } from './services';
  import { TeamStatsListModel } from './TeamStatsListModel.svelte';

  /**
   * In the team window, for its coaches, admin and board: answers and presence per member over a range (default the last 90 days),
   * and cancelling every appointment of the team on a range of days (holidays, a closed hall).
   */
  let { teamId }: { teamId: string } = $props();

  const today = session.clock.today();
  let from = $state(ZonedClock.addDays(today, -90));
  let to = $state(today);
  // svelte-ignore state_referenced_locally
  const stats = new TeamStatsListModel(() => calendarApi.teamStats(teamId, from, to), store);
  $effect(() => {
    void from;
    void to;
    if (from && to && from <= to) void stats.load();
  });

  let rangeOpen = $state(false);
  let rangeFrom = $state(today);
  let rangeTo = $state(today);
  let reason = $state('');
  const cancelRange = new Action();

  async function confirmRange() {
    let count = 0;
    if (await cancelRange.run(async () => (count = (await calendarApi.cancelRange(teamId, rangeFrom, rangeTo, reason.trim() || null)).length))) {
      rangeOpen = false;
      bus.publish(TOAST, { text: count ? `${count} ${count === 1 ? 'Termin' : 'Termine'} abgesagt.` : 'In diesem Zeitraum gibt es keine Termine.' });
      void stats.load();
    }
  }
</script>

{#if permissions.canManage(teamId)}
  <section class="stack">
    <h2>Anwesenheit</h2>
    <div class="row filters">
      <Field label="Von"><DateInput bind:value={from} max={to} /></Field>
      <Field label="Bis"><DateInput bind:value={to} min={from} /></Field>
    </div>
    {#if stats.data.value && !stats.appointments}
      <p class="muted">In diesem Zeitraum fanden keine Termine statt.</p>
    {:else}
      {#if stats.data.value}
        <p class="muted small">
          {stats.appointments}
          {stats.appointments === 1 ? 'Termin' : 'Termine'}. „Da“ zählt die Termine, bei denen die Anwesenheit eingetragen wurde.
        </p>
      {/if}
      <DataTable model={stats} rowKey={(m) => m.memberId} toolbar={false} emptyText="Keine Mitglieder im Team." />
    {/if}
    <div><Button onclick={() => (rangeOpen = true)}>Zeitraum absagen</Button></div>
  </section>

  <Dialog open={rangeOpen} title="Zeitraum absagen" onclose={() => (rangeOpen = false)}>
    <div class="stack">
      <p>Alle Termine des Teams an diesen Tagen fallen aus; das Team und die Erziehungsberechtigten werden benachrichtigt.</p>
      <div class="row">
        <Field label="Von"><DateInput bind:value={rangeFrom} min={today} /></Field>
        <Field label="Bis"><DateInput bind:value={rangeTo} min={rangeFrom} /></Field>
      </div>
      <Field label="Grund (optional)" hint="Etwa Ferien oder Halle gesperrt.">
        <input bind:value={reason} maxlength="300" />
      </Field>
      <ErrorNote error={cancelRange.error} />
      <div class="row">
        <Button variant="danger" busy={cancelRange.busy} onclick={confirmRange}>Termine absagen</Button>
        <Button variant="ghost" onclick={() => (rangeOpen = false)}>Abbrechen</Button>
      </div>
    </div>
  </Dialog>
{/if}

<style>
  .filters {
    align-items: end;
  }
</style>
