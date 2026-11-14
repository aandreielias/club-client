<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { BookingForm } from './BookingForm.svelte';
  import BookingEditor from './BookingEditor.svelte';
  import { accounts, categories, financeApi } from './services';

  /** New booking (`id` 'booking') or transfer (`id` 'transfer') in the window; afterwards the window shows it. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const transfer = id === 'transfer';
  const title = transfer ? 'Neue Umbuchung' : 'Neue Buchung';
  const form = BookingForm.blank(transfer, session.clock.today(), (key) => categories.get(key)?.direction);
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, title);
  void accounts.load();
  void categories.load();

  const submit = () =>
    create.submit(
      async () => (await (transfer ? financeApi.transfer(form.toTransfer()) : financeApi.create(form.toInput()))).id,
      'booking',
      transfer ? 'Umbuchung gebucht.' : 'Buchung angelegt.',
    );
</script>

<Detail {title}>
  <BookingEditor {form} action={create.save} submitLabel="Buchen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
