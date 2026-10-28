<script lang="ts">
  import { bus, pendingDeletes, session } from '../../lib/container';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { REF_ICONS, type RefKind } from '../../lib/records/refs';
  import { mailSegments } from './mailText';
  import { mailApi, mailCenter as center } from './services';

  /** One mail, opened from a mailbox list (`id` = mailbox:mail). Opening marks it read. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const [mailboxId, mailId] = id.split(':');
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const mail = new Resource(async () => {
    const value = await mailApi.get(mailboxId, mailId);
    void center.mailboxes.load(); // the unread counts changed
    return value;
  });
  void mail.load();
  view.title(() => mail.value?.subject);

  const compose = (mode: 'reply' | 'reply-all' | 'forward') => view.open('mail-new', `${mode}:${mailboxId}:${mailId}`);

  function destroy(inTrash: boolean) {
    pendingDeletes.schedule({
      ids: [mailId],
      text: inTrash ? 'E-Mail endgültig gelöscht.' : 'E-Mail in den Papierkorb verschoben.',
      commit: async () => {
        await mailApi.delete(mailboxId, mailId);
        await center.mailboxes.load();
      },
    });
    view.leave();
  }
</script>

<AsyncView resource={mail}>
  {#snippet children(value)}
    <Detail title={value.subject}>
      {#snippet actions()}
        {#if value.folder !== 'SENT'}<Button icon="reply" onclick={() => compose('reply')}>Antworten</Button>{/if}
        {#if value.folder !== 'SENT' && value.to.length + value.cc.length > 1}
          <Button onclick={() => compose('reply-all')}>Allen antworten</Button>
        {/if}
        <Button icon="forward" onclick={() => compose('forward')}>Weiterleiten</Button>
        {#if value.folder === 'TRASH'}
          <Button variant="danger" icon="delete" tooltip="Aus dem Papierkorb endgültig löschen" onclick={() => destroy(true)}
            >Endgültig löschen</Button
          >
        {:else}
          <Button variant="danger" icon="delete" tooltip="In den Papierkorb verschieben" onclick={() => destroy(false)}>Löschen</Button>
        {/if}
      {/snippet}

      <dl class="props">
        <dt>Von</dt>
        <dd>{value.fromName} &lt;{value.from}&gt;</dd>
        <dt>An</dt>
        <dd>{value.to.join(', ')}</dd>
        {#if value.cc.length}
          <dt>Cc</dt>
          <dd>{value.cc.join(', ')}</dd>
        {/if}
        <dt>Datum</dt>
        <dd>{session.format.dateTime(value.sentAt)}</dd>
      </dl>
      <!-- Club records linked in the mail open in the window; the reader's own rights decide what they see there. -->
      <p class="prose text">
        {#each mailSegments(value.body) as segment, i (i)}
          {#if 'kind' in segment}
            <span class="ref"
              ><Icon name={REF_ICONS[segment.kind.toUpperCase() as RefKind] ?? 'link'} small /><RecordLink kind={segment.kind} id={segment.id}
                >{segment.title}</RecordLink
              ></span
            >
          {:else}{segment.text}{/if}
        {/each}
      </p>
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .ref {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-xxs);
  }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
