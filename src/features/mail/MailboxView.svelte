<script lang="ts">
  import { backStack, bus } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import MailboxEditor from './MailboxEditor.svelte';
  import { MailboxForm } from './MailboxForm.svelte';
  import { mailApi, mailboxes, mailCenter } from './services';

  /** One club mailbox; admin and board change or remove it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

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

  function remove(address: string) {
    void stored.remove(
      `${address}: niemand liest die Adresse dann mehr in der App. Die E-Mails selbst bleiben beim Mail-Anbieter.`,
      'Postfach entfernen',
      'Postfach entfernt.',
      edit.save,
      async () => {
        await mailApi.deleteMailbox(id);
        await mailCenter.mailboxes.load();
      },
    );
  }
</script>

{#if mailbox}
  <Detail title={edit.form ? 'Postfach bearbeiten' : mailbox.address}>
    {#snippet actions()}
      {#if !edit.form}
        <Button icon="edit" onclick={() => edit.edit(MailboxForm.edit(mailbox))}>Bearbeiten</Button>
        <Button variant="danger" icon="delete" tooltip="Postfach aus der App entfernen" onclick={() => remove(mailbox.address)}>Löschen</Button>
      {/if}
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
        <dd>{mailbox.memberId ? (mailbox.memberName ?? 'Mitglied') : `Alle mit der Rolle ${ROLE_LABELS[mailbox.role!]}`}</dd>
      </dl>
    {/if}
  </Detail>
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
