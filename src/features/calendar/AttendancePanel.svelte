<script lang="ts">
  import { bus, permissions, session, store } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import { AttendanceListModel } from './AttendanceListModel.svelte';
  import { responseHue, responseLabel, type Appointment, type Attendance } from './model';
  import { appointmentPolicy as policy } from './services';

  /**
   * Answer counts plus the list of entries (reasons only where the server sends them). Who runs the team reminds the open ones
   * before the start and marks who came once it started.
   */
  let { attendance, detail, appointment }: { attendance: Attendance; detail: AppointmentDetailModel; appointment: Appointment } = $props();

  const runs = $derived(policy.runsTeam(appointment) && !appointment.cancelled);
  const started = $derived(policy.isPast(appointment));

  async function remind() {
    const count = await detail.remindOpen();
    if (count !== null)
      bus.publish(TOAST, {
        text: count ? `${count} ${count === 1 ? 'Mitglied' : 'Mitglieder'} erinnert.` : 'Schon erinnert oder alle haben geantwortet.',
      });
  }

  const list = new AttendanceListModel(
    async () => detail.attendance.value?.entries ?? [],
    () => session.format,
    store,
  );

  $effect(() => list.set(attendance.entries));

  const summary = $derived([
    { label: 'Zusagen', count: attendance.yes, hue: 'green' as const },
    { label: 'Vielleicht', count: attendance.maybe, hue: 'yellow' as const },
    { label: 'Absagen', count: attendance.no, hue: 'red' as const },
    { label: 'Offen', count: attendance.open, hue: 'gray' as const },
  ]);
</script>

<dl class="summary">
  {#each summary as item (item.label)}
    <div style:--hue="var(--color-tag-{item.hue}-text)">
      <dt>{item.label}</dt>
      <dd>{item.count}</dd>
    </div>
  {/each}
</dl>

{#if runs && !started && appointment.teamId && attendance.open > 0}
  <div class="row">
    <Button busy={detail.remindAction.busy} onclick={remind}>Offene erinnern</Button>
  </div>
{/if}
<ErrorNote error={detail.remindAction.error ?? detail.presenceAction.error} />

<DataTable model={list} rowKey={(e) => e.memberId} emptyText="Noch keine Antworten.">
  {#snippet cell(entry, column)}
    {#if column.key === 'status'}
      {#if entry.absent}<Tag tone="gray">Abwesend</Tag>{:else}<Tag tone={responseHue(entry.status)}>{responseLabel(entry.status)}</Tag>{/if}
      {#if entry.unconfirmed}<Tag tone="orange">Unbestätigt</Tag>{/if}
    {:else if column.key === 'present'}
      {#if runs && started}
        <span class="marks" role="group" aria-label="Anwesenheit {entry.name}">
          <Button
            size="sm"
            variant={entry.present === true ? 'primary' : 'ghost'}
            tooltip="{entry.name} war da"
            onclick={() => detail.setPresence(entry.memberId, entry.present === true ? null : true)}>Da</Button
          >
          <Button
            size="sm"
            variant={entry.present === false ? 'danger' : 'ghost'}
            tooltip="{entry.name} war nicht da"
            onclick={() => detail.setPresence(entry.memberId, entry.present === false ? null : false)}>Nicht da</Button
          >
        </span>
      {:else}
        <span class="muted">{list.display(entry, column)}</span>
      {/if}
    {:else if column.key === 'name'}
      <!-- Profiles open in the window where the viewer may see them (coaches: their teams). -->
      <RecordLink
        kind="member"
        id={entry.memberId}
        allowed={permissions.isPrivileged && permissions.canSeeMember(entry.memberId)}
        hint="Profil öffnen">{entry.name}</RecordLink
      >
    {:else if column.key === 'reason'}
      <span class="muted">{entry.reason ?? ''}</span>
    {:else}
      {list.display(entry, column)}
    {/if}
  {/snippet}
</DataTable>

<style>
  .marks {
    display: inline-flex;
    gap: var(--space-xxs);
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xl);
    margin: 0 0 var(--space-md);
  }
  .summary dt {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
  .summary dd {
    margin: 0;
    color: var(--hue);
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
  }
</style>
