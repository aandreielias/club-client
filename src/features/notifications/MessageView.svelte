<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Empty from '../../ui/Empty.svelte';
  import LinkedRecords from '../../ui/LinkedRecords.svelte';
  import { notificationCenter as center, notificationsApi } from './services';

  /** A received message with its sender and linked records; it comes from the inbox, which is already loaded. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  const message = $derived(center.inbox.value?.items.find((n) => n.id === id) ?? null);
  $effect(() => handle.setTitle(message?.title ?? 'Nachricht'));

  // An answer to the sender alone (server: SendMessage.replyTo).
  let replying = $state(false);
  let answer = $state('');
  const send = new Action();

  async function reply(event: SubmitEvent) {
    event.preventDefault();
    if (!message || !answer.trim()) return;
    const title = message.title.startsWith('Re: ') ? message.title : `Re: ${message.title}`;
    const ok = await send.run(() =>
      notificationsApi.send({
        title: title.slice(0, 150),
        body: answer.trim(),
        everyone: false,
        teamIds: [],
        memberIds: [],
        includeGuardians: false,
        refs: [],
        replyTo: message.id,
      }),
    );
    if (ok) {
      bus.publish(TOAST, { text: `Antwort an ${message.senderName ?? 'den Absender'} gesendet.` });
      replying = false;
      answer = '';
    }
  }
</script>

{#if message}
  <Detail title={message.title}>
    <dl class="props">
      <dt>Von</dt>
      <dd>{message.senderName ?? '–'}</dd>
      <dt>Erhalten</dt>
      <dd>{session.format.dateTime(message.createdAt)}</dd>
    </dl>
    {#if message.body}<p class="prose text">{message.body}</p>{/if}
    {#if message.senderId && message.senderId !== session.member.id}
      {#if replying}
        <form class="stack" onsubmit={reply}>
          <Field label="Antwort an {message.senderName ?? 'den Absender'}">
            <textarea bind:value={answer} rows="4" maxlength="1000" required></textarea>
          </Field>
          <ErrorNote error={send.error} />
          <div class="row">
            <Button type="submit" variant="primary" busy={send.busy} disabled={!answer.trim()}>Senden</Button>
            <Button variant="ghost" onclick={() => (replying = false)}>Abbrechen</Button>
          </div>
        </form>
      {:else}
        <div><Button icon="reply" onclick={() => (replying = true)}>Antworten</Button></div>
      {/if}
    {/if}
    {#if message.refs.length}
      <h2>Verknüpft</h2>
      <LinkedRecords refs={message.refs} />
    {/if}
  </Detail>
{:else}
  <Empty text="Diese Nachricht ist nicht mehr im Posteingang (älter als die letzten 100 Benachrichtigungen)." />
{/if}

<style>
  .text {
    white-space: pre-line;
  }
</style>
