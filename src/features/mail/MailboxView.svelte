<script lang="ts">
  import { backStack, bus, commands, directory } from '../../lib/container';
  import { boardSettings } from '../members/services';
  import { ownersText } from './ownersText';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { mailboxActions } from './actions';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import MailboxEditor from './MailboxEditor.svelte';
  import { MailboxForm } from './MailboxForm.svelte';
  import { mailApi, mailboxes, mailCenter } from './services';

  /** One club mailbox; admin and board change or remove it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  void boardSettings.load();
  void directory.loadTeams();
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<MailboxForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    mailboxes,
    () => id,
    'Dieses Postfach gibt es nicht mehr.',
    () => edit.save.busy,
  );
  const mailbox = $derived(stored.record);
  view.title(() => mailbox?.address);

  async function submit() {
    await edit.submit(async (form) => {
      await stored.saved(() => mailApi.saveMailbox(id, form.toInput()));
      await mailCenter.mailboxes.load();
    }, 'Postfach gespeichert.');
  }

  const act = useRecordActions(
    commands,
    mailboxActions,
    () => (edit.form ? null : mailbox),
    () => view.leave(),
  );
  useCommands(commands, {
    'record.edit': { run: () => mailbox && edit.edit(MailboxForm.edit(mailbox)), when: () => act.has('record.edit') },
  });
</script>

{#if mailbox}
  <Detail title={edit.form ? 'Postfach bearbeiten' : mailbox.address}>
    {#snippet actions()}
      <RecordActionButtons actions={act} />
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <MailboxEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Adresse</dt>
        <dd>{mailbox.address}</dd>
        <dt>Absendername</dt>
        <dd>{mailbox.name}</dd>
        <dt>Wer liest es</dt>
        <dd>{mailbox.memberId ? (mailbox.memberName ?? 'Mitglied') : ownersText(mailbox.owners)}</dd>
      </dl>
    {/if}
  </Detail>
{:else}
  <DetailSkeleton />
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
