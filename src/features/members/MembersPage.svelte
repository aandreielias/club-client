<script lang="ts">
  import { bus, commands, errors, session, store } from '../../lib/container';
  import { CONFIRM, TOAST, WINDOW_OPEN } from '../../channels';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import MemberTable from './MemberTable.svelte';

  import Page from '../../ui/Page.svelte';
  import { MEMBER_DEACTIVATED, MEMBER_INVITED } from './events';
  import { membersToCsv, parseMemberImport, runMemberImport, type ImportProblem } from './MemberCsv.svelte';
  import { MemberListModel } from './MemberListModel.svelte';
  import { boardSettings, memberPolicy as policy, membersApi, membershipKinds } from './services';

  // The list needs a step-up: the PIN dialog appears on first load.
  const list = new MemberListModel(membersApi, store);
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
    const existing = new Set((list.data.value ?? []).map((m) => m.email.toLowerCase()));
    const parsed = parseMemberImport(
      await file.text(),
      session.clock.today(),
      existing,
      policy.grantableRoles(),
      membershipLabels(),
      boardSettings.value?.multipleKinds ?? false,
    );
    problems = parsed.problems;
    if (!parsed.rows.length) {
      bus.publish(TOAST, { text: 'Keine neuen Mitglieder in der Datei.', tone: 'error' });
      return;
    }
    const skipped = parsed.problems.length ? ` ${parsed.problems.length} Zeilen werden übersprungen (siehe Liste).` : '';
    const ok = await bus.request(CONFIRM, {
      title: 'Mitglieder importieren',
      message: `${parsed.rows.length} Konten anlegen? Jedes bekommt sofort eine Einladungs-E-Mail.${skipped}`,
      confirmLabel: 'Anlegen und einladen',
    });
    if (!ok) return;
    importing = true;
    try {
      const failed = await runMemberImport(membersApi, parsed.rows, (e) => errors.text(e));
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

  function picked(): void {
    const file = fileInput?.files?.[0];
    if (fileInput) fileInput.value = '';
    if (file) void importCsv(file);
  }
</script>

<Page title="Mitglieder">
  {#snippet actions()}
    {#if policy.canInvite()}
      <Button icon="download" onclick={exportCsv} disabled={!list.rows.length}>Exportieren</Button>
      <Button icon="upload" onclick={() => fileInput?.click()} busy={importing}>Importieren</Button>
      <input bind:this={fileInput} type="file" accept=".csv,text/csv" onchange={picked} hidden />
      <Button variant="primary" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' })}>Neues Konto</Button>
    {/if}
  {/snippet}

  {#if problems.length}
    <section class="problems" aria-live="polite">
      <p><strong>Import: {problems.length} Zeilen nicht angelegt</strong> <Button onclick={() => (problems = [])}>Ausblenden</Button></p>
      <ul>
        {#each problems as p (p.line + p.text)}<li>Zeile {p.line}: {p.text}</li>{/each}
      </ul>
    </section>
  {/if}

  <MemberTable
    {list}
    emptyAction={policy.canInvite()
      ? { label: 'Neues Konto', icon: 'add', run: () => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' }) }
      : null}
  />
  {#if list.data.value}<p class="muted small count">{list.activeCount} aktive Mitglieder</p>{/if}
</Page>

<style>
  .count {
    margin-top: var(--space-sm);
  }
  .problems {
    margin-bottom: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
</style>
