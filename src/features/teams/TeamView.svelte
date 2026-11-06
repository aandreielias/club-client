<script lang="ts">
  import { backStack, bus, directory, permissions, router, session, store, windows } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { TEAM_ROLE_LABELS, type RosterEntry, type TeamRole } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AddMemberPanel from './AddMemberPanel.svelte';
  import TeamAttendanceSection from '../calendar/TeamAttendanceSection.svelte';
  import TeamMatchesSection from '../calendar/TeamMatchesSection.svelte';
  import TeamEditor from './TeamEditor.svelte';
  import { TeamForm } from './TeamForm.svelte';
  import TeamActionDialog from './TeamActionDialog.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { MEMBERSHIP_CHANGED, TEAMS_CHANGED } from './events';
  import { RosterListModel } from './RosterListModel.svelte';
  import { RosterModel } from './RosterModel.svelte';
  import { teamPolicy as policy, teamsApi } from './services';

  /** One team: season, roster with roles; adding and removing members for those allowed. Window and page. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  const ROLE_OPTIONS = Object.entries(TEAM_ROLE_LABELS).map(([value, label]) => ({ value: value as TeamRole, label }));

  // svelte-ignore state_referenced_locally
  const model = new RosterModel(teamsApi, directory, id);
  const list = new RosterListModel(model, store);
  void list.load();
  void directory.loadRosters([model.teamId]); // exact team roles for the permission checks

  // Writes answer with the new roster; the list shows the same entries.
  $effect(() => {
    const entries = model.roster.value?.entries;
    if (entries) list.set(entries);
  });

  let adding = $state(false);
  const edit = new EditSession<TeamForm>(bus, backStack);
  let dialog = $state<{ kind: 'player' | 'season' | 'request'; entry?: RosterEntry } | null>(null);
  const archiveAction = new Action();

  function dialogDone(result: unknown) {
    const kind = dialog?.kind;
    dialog = null;
    if (kind === 'player') {
      model.roster.set(result as never);
      view.notify('Gespeichert.');
    } else if (kind === 'season') {
      directory.forgetTeams();
      view.notify('Neue Saison angelegt.');
      view.open('team', (result as { id: string }).id);
    } else view.notify('Anfrage an Vorstand und Admins gesendet.');
  }

  // Several members at once: a new role (admin/board) or out of the team (also coaches, for players).
  let selecting = $state(false);
  let chosen = $state<ReadonlySet<string>>(new Set());
  let bulkRole = $state<TeamRole | ''>('');
  const picked = $derived((model.roster.value?.entries ?? []).filter((e) => chosen.has(e.memberId)));

  function toggleChosen(entry: RosterEntry) {
    const next = new Set(chosen);
    if (!next.delete(entry.memberId)) next.add(entry.memberId);
    chosen = next;
  }

  function stopSelecting() {
    selecting = false;
    chosen = new Set();
    bulkRole = '';
  }

  async function bulkSetRole() {
    const role = bulkRole;
    if (!role) return;
    for (const entry of picked)
      if (entry.teamRole !== role && !(await view.attempt(model.assignAction, () => model.assign(entry.memberId, role)))) break;
    view.notify('Rollen geändert.');
    stopSelecting();
  }

  async function bulkRemove() {
    const removable = picked.filter((e) => policy.canRemove(model.teamId, e));
    const request = {
      title: 'Aus dem Team entfernen',
      message: `${removable.length} ${removable.length === 1 ? 'Mitglied wird' : 'Mitglieder werden'} aus dem Team entfernt.${removable.length < picked.length ? ' Andere darfst du nicht entfernen.' : ''}`,
      confirmLabel: 'Entfernen',
      danger: true,
    };
    const ok = await view.confirm(
      request,
      async () => {
        for (const entry of removable) if (!(await view.attempt(model.removeAction, () => model.remove(entry)))) return false;
        return true;
      },
      'Aus dem Team entfernt.',
    );
    if (ok) stopSelecting();
  }

  async function setArchived(archived: boolean) {
    if (await view.attempt(archiveAction, () => archiveAction.run(() => teamsApi.update(model.teamId, { archived })))) {
      directory.forgetTeams();
      void model.load();
      view.notify(archived ? 'Team archiviert.' : 'Team wiederhergestellt.');
    }
  }
  const deleteAction = new Action();
  backStack.while(
    () => adding,
    () => (adding = false),
  );

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  view.title(() => model.roster.value?.team.name ?? directory.teamName(id) ?? undefined);

  useBus(bus, MEMBERSHIP_CHANGED, ({ data }) => {
    if (data.teamId === model.teamId && !model.busy) void model.load();
  });

  async function changeRole(entry: RosterEntry, role: TeamRole) {
    if (role !== entry.teamRole) await view.attempt(model.assignAction, () => model.assign(entry.memberId, role));
  }

  async function remove(entry: RosterEntry) {
    const request = {
      title: 'Aus dem Team entfernen',
      message: `${entry.name} wird aus dem Team entfernt.`,
      confirmLabel: 'Entfernen',
      danger: true,
    };
    await view.confirm(request, () => view.attempt(model.removeAction, () => model.remove(entry)), 'Aus dem Team entfernt.');
  }

  async function deleteTeam(name: string) {
    const request = {
      title: 'Team löschen',
      message: `„${name}“ wird gelöscht, die Mitgliedschaften mit ihm.`,
      confirmLabel: 'Löschen',
      danger: true,
    };
    const deleted = await view.confirm(
      request,
      () => view.attempt(deleteAction, () => deleteAction.run(() => teamsApi.delete(model.teamId))),
      'Team gelöscht.',
    );
    if (deleted) {
      directory.forgetTeams();
      view.leave();
    }
  }

  function startEdit(name: string, season: string) {
    const form = new TeamForm(session.clock, session.club?.seasonStartMonth ?? 7);
    Object.assign(form, { name, season });
    edit.edit(form);
  }

  async function rename() {
    await edit.submit(async (form) => {
      await teamsApi.update(model.teamId, { name: form.name.trim(), season: form.season.trim() });
      directory.forgetTeams();
      bus.publish(TEAMS_CHANGED);
      await model.load();
    }, 'Team gespeichert.');
  }

  function open(entry: RosterEntry) {
    if (policy.canOpenProfile(model.teamId, entry)) view.open('member', entry.memberId);
  }

  function rowMenu(entry: RosterEntry): MenuEntry[] {
    return [
      ...(policy.canOpenProfile(model.teamId, entry) ? windowMenu(bus, windows, router, 'member', entry.memberId) : []),
      { separator: true },
      ...(policy.canRemove(model.teamId, entry) ? [{ label: 'Aus dem Team entfernen', danger: true, run: () => void remove(entry) }] : []),
    ];
  }
</script>

<Detail title={model.roster.value?.team.name ?? directory.teamName(id) ?? 'Team'}>
  {#snippet actions()}
    {#if policy.canAssign() && !adding}<Button variant="primary" onclick={() => (adding = true)}>Mitglied hinzufügen</Button>{/if}
    {#if selecting}
      <span class="muted">{chosen.size} ausgewählt</span>
      {#if policy.canAssign()}
        <Select inline aria-label="Neue Rolle" placeholder="Rolle …" value={bulkRole} options={ROLE_OPTIONS} onchange={(r) => (bulkRole = r)} />
        <Button disabled={!chosen.size || !bulkRole} busy={model.busy} onclick={bulkSetRole}>Rolle setzen</Button>
      {/if}
      <Button variant="danger" disabled={!chosen.size} busy={model.busy} onclick={bulkRemove}>Entfernen</Button>
      <Button variant="ghost" onclick={stopSelecting}>Fertig</Button>
    {:else if policy.canAssign() || policy.canSetPlayerInfo(model.teamId)}
      <Button onclick={() => (selecting = true)}>Auswählen</Button>
    {/if}
    {#if policy.canRequestPlayer(model.teamId)}<Button onclick={() => (dialog = { kind: 'request' })}>Spieler:in anfragen</Button>{/if}
    {#if policy.canEdit() && model.roster.value}
      {@const team = model.roster.value.team}
      <Button icon="edit" disabled={edit.editing} onclick={() => startEdit(team.name, team.season)}>Bearbeiten</Button>
      <Button onclick={() => (dialog = { kind: 'season' })}>Neue Saison</Button>
      {#if team.archived}
        <Button busy={archiveAction.busy} onclick={() => setArchived(false)}>Wiederherstellen</Button>
      {:else}
        <Button busy={archiveAction.busy} onclick={() => setArchived(true)}>Archivieren</Button>
      {/if}
      <Button variant="danger" icon="delete" busy={deleteAction.busy} onclick={() => deleteTeam(team.name)}>Löschen</Button>
    {/if}
  {/snippet}
  {#snippet meta()}
    {#if model.roster.value}
      <Tag tone="gray">Saison {model.roster.value.team.season}</Tag>
      {#if model.roster.value.team.archived}<Tag tone="gray">Archiviert</Tag>{/if}
      <span class="muted">{model.roster.value.entries.length} Mitglieder</span>
    {/if}
  {/snippet}

  {#if edit.form}
    <div class="editing" {@attach edit.track}>
      <TeamEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={rename} />
    </div>
  {/if}
  {#if adding}
    <div class="add"><AddMemberPanel {model} onclose={() => (adding = false)} /></div>
  {/if}

  <AsyncView resource={model.roster}>
    {#snippet children()}
      <DataTable
        model={list}
        rowKey={(e) => e.memberId}
        onopen={selecting ? undefined : open}
        check={selecting ? { checked: (e) => chosen.has(e.memberId), toggle: toggleChosen, label: (e) => `${e.name} auswählen` } : undefined}
        record={(e) => (permissions.canSeeMember(e.memberId) ? { kind: 'member', id: e.memberId, title: e.name } : null)}
        menu={rowMenu}
        emptyText="Noch keine Mitglieder im Team."
      >
        {#snippet cell(entry, column)}
          {#if column.key === 'role'}
            {#if policy.canAssign()}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <span onclick={(e) => e.stopPropagation()}>
                <Select
                  inline
                  aria-label="Rolle von {entry.name}"
                  value={entry.teamRole}
                  options={ROLE_OPTIONS}
                  disabled={model.busy}
                  onchange={(role) => changeRole(entry, role)}
                />
              </span>
            {:else}
              <Tag tone={entry.teamRole === 'PLAYER' ? 'green' : 'blue'}>{list.display(entry, column)}</Tag>
            {/if}
          {:else if column.key === 'name'}
            {entry.name}{#if entry.captain}&nbsp;<Tag tone="orange">Kapitän:in</Tag>{/if}
          {:else if column.key === 'actions'}
            {#if policy.canSetPlayerInfo(model.teamId)}
              <Button
                size="sm"
                variant="ghost"
                onclick={(e) => (e.stopPropagation(), (dialog = { kind: 'player', entry }))}
                tooltip="Nummer, Position und Kapitän:in von {entry.name}">Nr.</Button
              >
            {/if}
            {#if policy.canRemove(model.teamId, entry)}
              <Button
                size="sm"
                variant="ghost"
                disabled={model.busy}
                onclick={(e) => (e.stopPropagation(), remove(entry))}
                tooltip="Aus dem Team entfernen">Entfernen</Button
              >
            {/if}
          {:else}
            {list.display(entry, column)}
          {/if}
        {/snippet}
      </DataTable>
    {/snippet}
  </AsyncView>
  <TeamMatchesSection teamId={model.teamId} />
  <TeamAttendanceSection teamId={model.teamId} />
</Detail>
{#if dialog && model.roster.value}
  <TeamActionDialog
    kind={dialog.kind}
    team={model.roster.value.team}
    entry={dialog.entry ?? null}
    ondone={dialogDone}
    onclose={() => (dialog = null)}
  />
{/if}

<style>
  .editing,
  .add {
    margin-bottom: var(--space-lg);
  }
</style>
