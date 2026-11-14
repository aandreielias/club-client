<script lang="ts">
  import { bus, commands, directory, errors, session, store } from '../../lib/container';
  import { CONFIRM, TOAST, WINDOW_OPEN } from '../../channels';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import { usePane } from '../../lib/split/usePane';
  import OrgChart from './OrgChart.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Select from '../../ui/Select.svelte';
  import MemberTable from './MemberTable.svelte';

  import Page from '../../ui/Page.svelte';
  import { PRIVILEGED } from '../../lib/types';
  import { MEMBER_DEACTIVATED, MEMBER_INVITED } from './events';
  import { membersToCsv, parseMemberImport, runMemberImport, type ImportProblem } from './MemberCsv.svelte';
  import { teamsApi } from '../teams/services';
  import { MemberListModel, type MemberRow } from './MemberListModel.svelte';
  import { boardSettings, memberPolicy as policy, membersApi, membershipKinds } from './services';

  const pane = usePane();
  const VIEWS = [
    { value: 'list', label: 'Liste' },
    { value: 'org', label: 'Organigramm' },
  ] as const;
  // The Organigramm is for coaches, admin and board (server: MemberHandlers.orgChart).
  const orgAllowed = $derived(session.hasRole(...PRIVILEGED));
  const view = $derived(orgAllowed && pane.query.get('view') === 'org' ? 'org' : 'list');

  const list = new MemberListModel(membersApi, store, policy.isManager);
  void list.load();
  useBus(bus, [MEMBER_INVITED, MEMBER_DEACTIVATED], () => void list.load());

  useCommands(commands, { 'page.new': { run: () => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' }), when: () => policy.canInvite() } });

  let fileInput = $state<HTMLInputElement>();
  let importing = $state(false);
  let problems = $state<ImportProblem[]>([]);

  /** Exports what the list shows (search and filters applied). */
  function exportCsv(): void {
    BrowserFile.save(
      new Blob([membersToCsv(list.rows, membershipLabels())], { type: 'text/csv;charset=utf-8' }),
      `mitglieder-${session.clock.today()}.csv`,
    );
  }

  const membershipLabels = () => Object.fromEntries(membershipKinds.items.map((k) => [k.key, k.label]));

  async function importCsv(file: File): Promise<void> {
    const existing = new Set((list.data.value ?? []).flatMap((m) => (m.email ? [m.email.toLowerCase()] : [])));
    const parsed = parseMemberImport(
      await file.text(),
      session.clock.today(),
      existing,
      policy.grantableRoles(),
      membershipLabels(),
      boardSettings.value?.multipleKinds ?? false,
    );
    if (!parsed.rows.length) {
      bus.publish(TOAST, { text: 'Keine neuen Mitglieder in der Datei.', tone: 'error' });
      problems = parsed.problems;
      return;
    }
    // The skipped lines are listed after the import, so the confirmation does not open over that list.
    const skipped = parsed.problems.length ? ` ${parsed.problems.length} Zeilen werden übersprungen; die Liste folgt danach.` : '';
    const ok = await bus.request(CONFIRM, {
      title: 'Mitglieder importieren',
      message: `${parsed.rows.length} Konten anlegen? Jedes bekommt sofort eine Einladungs-E-Mail.${skipped}`,
      confirmLabel: 'Anlegen und einladen',
    });
    if (!ok) return;
    importing = true;
    try {
      await directory.loadTeams().catch(() => {});
      const existingByEmail = new Map((list.data.value ?? []).flatMap((m) => (m.email ? [[m.email.toLowerCase(), m.id] as const] : [])));
      const failed = await runMemberImport(membersApi, parsed.rows, (e) => errors.text(e), {
        existing: existingByEmail,
        teams: directory.teams,
        setTeam: (teamId, memberId) => teamsApi.setMember(teamId, memberId, 'PLAYER'),
      });
      problems = [...parsed.problems, ...failed].sort((a, b) => a.line - b.line);
      bus.publish(TOAST, {
        text: `${parsed.rows.length - failed.length} von ${parsed.rows.length} Konten angelegt.`,
        tone: failed.length ? 'error' : 'info',
      });
    } finally {
      importing = false;
      void list.load();
    }
  }

  // Bulk actions (admin/board): pick rows, then copy addresses, add to a team or set the membership kind.
  let selecting = $state(false);
  let chosen = $state(new Set<string>());
  let bulkTeam = $state('');
  let bulkKind = $state('');
  let bulkBusy = $state(false);
  const selectable = (m: MemberRow) => !m.nameOnly && m.active;
  const chosenRows = $derived(list.rows.filter((m) => chosen.has(m.id) && selectable(m)));
  const toggle = (m: MemberRow) => {
    const next = new Set(chosen);
    if (!next.delete(m.id)) next.add(m.id);
    chosen = next;
  };
  const stopSelecting = () => ((selecting = false), (chosen = new Set()));
  const teamOptions = $derived(directory.teams.filter((t) => !t.archived).map((t) => ({ value: t.id, label: t.name })));
  const kindOptions = $derived(membershipKinds.items.filter((k) => !k.archived).map((k) => ({ value: k.key, label: k.label })));

  async function copyAddresses() {
    const emails = chosenRows.flatMap((m) => (m.email ? [m.email] : []));
    try {
      await navigator.clipboard.writeText(emails.join('; '));
      bus.publish(TOAST, { text: `${emails.length} E-Mail-Adressen kopiert, etwa für Bcc.` });
    } catch {
      bus.publish(TOAST, { text: 'Kopieren ist hier nicht möglich.', tone: 'error' });
    }
  }

  /** One request per member, in order; stops at the first error and says how far it got. */
  async function runBulk(confirm: string, each: (m: MemberRow) => Promise<unknown>, done: string) {
    const rows = chosenRows;
    if (!(await bus.request(CONFIRM, { title: 'Für Auswahl ausführen', message: confirm, confirmLabel: 'Ausführen' }))) return;
    bulkBusy = true;
    let count = 0;
    try {
      for (const m of rows) {
        await each(m);
        count++;
      }
      bus.publish(TOAST, { text: done });
      stopSelecting();
    } catch (e) {
      bus.publish(TOAST, { text: `${count} von ${rows.length} erledigt. ${errors.text(e)}`, tone: 'error' });
    } finally {
      bulkBusy = false;
      void list.load();
    }
  }

  const addToTeam = () =>
    runBulk(
      `${chosenRows.length} Mitglieder als Spieler:innen in ${directory.teamName(bulkTeam)} aufnehmen? Wer schon im Team ist, wird Spieler:in.`,
      (m) => teamsApi.setMember(bulkTeam, m.id, 'PLAYER'),
      'Ins Team aufgenommen.',
    );
  const setKind = () =>
    runBulk(
      `${chosenRows.length} Mitglieder bekommen die Mitgliedsart „${membershipKinds.label(bulkKind)}“; ihre bisherige wird ersetzt.`,
      (m) => membersApi.setMembership(m.id, { membershipTypes: [bulkKind], memberSince: m.memberSince }),
      'Mitgliedsart gesetzt.',
    );

  function picked(): void {
    const file = fileInput?.files?.[0];
    if (fileInput) fileInput.value = '';
    if (file) void importCsv(file);
  }
</script>

<Page title="Mitglieder">
  {#snippet actions()}
    {#if orgAllowed}
      <ChoiceGroup
        name="members-view"
        label="Ansicht"
        options={VIEWS}
        bind:value={() => view, (v) => pane.updateQuery({ view: v === 'org' ? 'org' : null }, true)}
      />
    {/if}
    {#if selecting}
      <span class="muted">{chosenRows.length} ausgewählt</span>
      <Button onclick={() => (chosen = new Set(list.rows.filter(selectable).map((m) => m.id)))}>Alle</Button>
      <Button disabled={!chosenRows.length} onclick={copyAddresses}>Adressen kopieren</Button>
      <Select inline aria-label="Team" placeholder="Team …" value={bulkTeam} options={teamOptions} onchange={(v) => (bulkTeam = v)} />
      <Button disabled={!chosenRows.length || !bulkTeam} busy={bulkBusy} onclick={addToTeam}>Ins Team</Button>
      <Select inline aria-label="Mitgliedsart" placeholder="Mitgliedsart …" value={bulkKind} options={kindOptions} onchange={(v) => (bulkKind = v)} />
      <Button disabled={!chosenRows.length || !bulkKind} busy={bulkBusy} onclick={setKind}>Mitgliedsart setzen</Button>
      <Button variant="ghost" onclick={stopSelecting}>Fertig</Button>
    {:else if policy.canInvite() && view === 'list'}
      <Button
        tooltip="Mehrere Mitglieder auswählen: Adressen kopieren, ins Team aufnehmen, Mitgliedsart setzen"
        onclick={() => ((selecting = true), void directory.loadTeams(), void membershipKinds.load())}>Auswählen</Button
      >
      <Button icon="download" onclick={exportCsv} disabled={!list.rows.length}>Exportieren</Button>
      <Button icon="upload" onclick={() => fileInput?.click()} busy={importing}>Importieren</Button>
      <input bind:this={fileInput} type="file" accept=".csv,text/csv" onchange={picked} hidden />
      <Button variant="primary" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' })}>Neues Konto</Button>
    {/if}
  {/snippet}

  {#if view === 'org'}
    <OrgChart />
  {:else}
    <MemberTable
      {list}
      check={selecting
        ? { checked: (m) => chosen.has(m.id), toggle, disabled: (m) => !selectable(m), label: (m) => `${m.firstName} ${m.lastName} auswählen` }
        : undefined}
      emptyAction={policy.canInvite()
        ? { label: 'Neues Konto', icon: 'add', run: () => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' }) }
        : null}
    />
    {#if list.data.value}<p class="muted small count">{list.activeCount} aktive Mitglieder</p>{/if}
  {/if}
</Page>

<Dialog open={problems.length > 0} title="Import: {problems.length} Zeilen nicht angelegt" wide onclose={() => (problems = [])}>
  <div class="stack">
    <ul class="problems">
      {#each problems as p (p.line + p.text)}<li>Zeile {p.line}: {p.text}</li>{/each}
    </ul>
    <div><Button variant="primary" onclick={() => (problems = [])}>Schließen</Button></div>
  </div>
</Dialog>

<style>
  .count {
    margin-top: var(--space-sm);
  }
  .problems {
    margin: 0;
    padding-left: var(--space-lg);
  }
</style>
