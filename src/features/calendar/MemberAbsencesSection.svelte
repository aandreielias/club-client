<script lang="ts">
  import { bus, pendingDeletes, session } from '../../lib/container';
  import { NAVIGATE } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import { menu } from '../../ui/contextMenu';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { ABSENCES_CHANGED } from './events';
  import type { Absence } from './model';
  import { calendarApi } from './services';

  /**
   * A member's current and future absences on the profile (server: AttendanceHandlers.listAbsences with memberId): for the member,
   * guardians, coaches of the member's teams, admin and board; hidden for everyone else and when there are none.
   */
  let { memberId }: { memberId: string } = $props();

  // svelte-ignore state_referenced_locally
  const absences = new Resource(() => calendarApi.absences(memberId));
  void absences.load();
  useBus(bus, ABSENCES_CHANGED, () => void absences.load());

  // Who enters them (the member, a guardian) also deletes them (server: deleteAbsence).
  const owner = $derived(memberId === session.member.id || session.wardIds.includes(memberId));
  const shown = $derived((absences.value ?? []).filter((a) => !pendingDeletes.isHidden(a.id)));

  const when = (a: Absence) => (a.from === a.to ? session.format.date(a.from) : `${session.format.date(a.from)} – ${session.format.date(a.to)}`);

  function remove(a: Absence) {
    pendingDeletes.schedule({
      ids: [a.id],
      text: 'Abwesenheit gelöscht.',
      commit: async () => {
        await calendarApi.deleteAbsence(a.id);
        bus.publish(ABSENCES_CHANGED);
      },
    });
  }

  function rowMenu(a: Absence): MenuEntry[] {
    return [
      { label: 'Alle Abwesenheiten öffnen', run: () => bus.publish(NAVIGATE, { path: '/calendar/absences' }) },
      { separator: true },
      { label: 'Löschen', icon: 'delete', danger: true, run: () => remove(a) },
    ];
  }
</script>

{#if shown.length}
  <SectionHeading title="Abwesenheiten" hint="Heute und später. Termine an diesen Tagen zählen als „Nein“, bis eine andere Antwort kommt." />
  <ul class="rows">
    {#each shown as absence (absence.id)}
      <li {@attach owner ? menu(() => rowMenu(absence)) : undefined}>
        <span>{when(absence)}</span>
        {#if absence.reason}<span class="muted ellipsis">{absence.reason}</span>{/if}
        {#if owner}
          <Button size="sm" variant="ghost" icon="delete" tooltip="Abwesenheit löschen" onclick={() => remove(absence)} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}
