<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import MailboxEditor from './MailboxEditor.svelte';
  import { MailboxForm } from './MailboxForm.svelte';
  import { mailApi, mailboxes, mailCenter } from './services';

  /** New club mailbox in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new MailboxForm();
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Postfach');

  const submit = () =>
    create.submit(
      async () => {
        const saved = await mailApi.saveMailbox(null, form.toInput());
        await Promise.all([mailboxes.load(), mailCenter.mailboxes.load()]);
        return saved.id;
      },
      'mailbox',
      'Postfach angelegt.',
    );
</script>

<Detail title="Neues Postfach">
  <MailboxEditor {form} action={create.save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
