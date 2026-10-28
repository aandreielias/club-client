<script lang="ts">
  import { untrack } from 'svelte';
  import { bus, commands, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Page from '../../ui/Page.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { MailListModel } from './MailListModel.svelte';
  import { MAIL_FOLDERS, type MailFolder } from './model';
  import { mailApi, mailCenter as center } from './services';

  /** The member's mailboxes: pick a mailbox and folder, open a mail in the window (docked to the side it reads like a mail app). */
  const list = new MailListModel(mailApi, () => session.format, store);
  const boxes = $derived(center.mailboxes.value ?? []);

  // The first mailbox is chosen once the center has loaded; every reload of the counts (new mail, mail read) reloads the folder too.
  $effect(() => {
    const current = boxes;
    untrack(() => {
      if (!current.some((b) => b.id === list.mailboxId)) list.mailboxId = current[0]?.id ?? null;
      void list.load();
    });
  });

  const options = $derived(boxes.map((b) => ({ value: b.id, label: b.unread ? `${b.name} (${b.unread})` : b.name })));
  const compose = () => bus.publish(WINDOW_OPEN, { kind: 'mail-new', id: list.mailboxId ?? '-' });
  const open = (mailId: string) => bus.publish(WINDOW_OPEN, { kind: 'mail', id: `${list.mailboxId}:${mailId}` });
  const selected = $derived(windows.current?.kind === 'mail' ? (windows.current.id.split(':')[1] ?? null) : null);

  function choose(folder: MailFolder | null) {
    list.folder = folder ?? 'INBOX';
    void list.load();
  }

  useCommands(commands, { 'page.new': { run: compose, when: () => boxes.length > 0 } });
</script>

<Page title="E-Mail">
  {#snippet actions()}
    {#if boxes.length}<Button variant="primary" icon="mail" onclick={compose}>Neue E-Mail</Button>{/if}
  {/snippet}
  {#snippet context()}
    {#if boxes.length > 1}
      <Select
        inline
        aria-label="Postfach"
        {options}
        bind:value={() => list.mailboxId ?? '', (id) => ((list.mailboxId = id || null), void list.load())}
      />
    {:else if boxes.length}
      <span class="muted">{boxes[0].address}</span>
    {/if}
    {#if boxes.length}
      <ChoiceGroup name="mail-folder" label="Ordner" size="sm" options={MAIL_FOLDERS} bind:value={() => list.folder, choose} />
    {/if}
  {/snippet}

  {#if center.mailboxes.value && !boxes.length}
    <Empty text="Du hast noch kein Vereins-Postfach. Der Vorstand richtet es ein." />
  {:else}
    <DataTable
      model={list}
      rowKey={(m) => m.id}
      onopen={(m) => open(m.id)}
      {selected}
      emptyText={list.folder === 'INBOX' ? 'Keine E-Mails im Posteingang.' : 'Dieser Ordner ist leer.'}
    >
      {#snippet cell(mail, column)}
        {#if column.key === 'subject'}
          <span class:unread={!mail.read}>{mail.subject}</span>
          {#if !mail.read}<Tag tone="blue">Neu</Tag>{/if}
          <span class="muted preview">{mail.preview}</span>
        {:else}
          <span class:unread={!mail.read}>{list.display(mail, column)}</span>
        {/if}
      {/snippet}
    </DataTable>
  {/if}
</Page>

<style>
  .unread {
    font-weight: var(--font-weight-bold);
  }
  .preview {
    margin-left: var(--space-sm);
  }
</style>
