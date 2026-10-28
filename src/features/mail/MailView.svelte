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
  import { mailSegments, recordTarget } from './mailText';
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

  /** Links in a formatted mail: club records open in the window, others in a new tab. */
  function follow(event: MouseEvent) {
    const link = (event.target as Element).closest('a');
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute('href') ?? '';
    const record = recordTarget(href);
    if (record) view.open(record.kind, record.id);
    else if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
  }

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
        {#if value.bcc.length}
          <dt>Bcc</dt>
          <dd>{value.bcc.join(', ')}</dd>
        {/if}
        <dt>Datum</dt>
        <dd>{session.format.dateTime(value.sentAt)}</dd>
      </dl>
      {#if value.html}
        <!-- Cleaned by the server (mail.domain.MailHtml: formatting tags and links only). -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="prose html" onclick={follow}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html value.html}
        </div>
      {:else}
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
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .ref {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-xxs);
  }
  .html {
    overflow-wrap: anywhere;
  }
  .html :global(blockquote) {
    margin: var(--space-xs) 0;
    padding-left: var(--space-sm);
    border-left: 3px solid var(--color-border-strong);
    color: var(--color-text-muted);
  }
  .html :global(a[href*='/app/records/']),
  .html :global(a[href^='club:']) {
    padding: 0 var(--space-xxs);
    border-radius: var(--radius-sm);
    background: var(--color-accent-soft);
    color: inherit;
    text-decoration: none;
  }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
