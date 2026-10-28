<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Empty from '../../ui/Empty.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import RichTextEditor from '../../ui/RichTextEditor.svelte';
  import { mailApi, mailCenter as center } from './services';

  /** The signature of one mailbox (`id`), added below "-- " to every new mail, reply and forward written from it. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const mailbox = $derived((center.mailboxes.value ?? []).find((b) => b.id === id));
  let html = $state('');
  let loaded = false;
  $effect(() => {
    if (mailbox && !loaded) {
      loaded = true;
      html = mailbox.signature ?? '';
    }
  });
  $effect(() => handle.setTitle(mailbox ? `Signatur ${mailbox.address}` : 'Signatur'));

  const save = new Action();
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (await save.run(() => mailApi.setSignature(id, html))) {
      await center.mailboxes.load();
      bus.publish(TOAST, { text: html ? 'Signatur gespeichert.' : 'Signatur entfernt.' });
      handle.close();
    }
  }
</script>

{#if mailbox?.signatureEditable}
  <Detail title="Signatur">
    <form class="stack" onsubmit={submit}>
      <p class="muted">Steht unter jeder neuen E-Mail, Antwort und Weiterleitung aus {mailbox.address}. Leer lassen für keine Signatur.</p>
      <RichTextEditor bind:value={html} label="Signatur" placeholder="z. B. Name, Funktion im Verein, Telefon" rows={5} />
      <ErrorNote error={save.error} />
      <div class="row">
        <Button type="submit" variant="primary" busy={save.busy}>Speichern</Button>
        <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
      </div>
    </form>
  </Detail>
{:else if center.mailboxes.value}
  <Empty text="Diese Signatur kannst du nicht ändern." />
{/if}

<style>
  p {
    margin: 0;
  }
</style>
