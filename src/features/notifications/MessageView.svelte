<script lang="ts">
  import { session } from '../../lib/container';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { kindLabel } from '../search/model';
  import { REF_ICONS, refWindow } from './model';
  import { notificationCenter as center } from './services';

  /** A received message with its sender and linked records; it comes from the inbox, which is already loaded. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  const message = $derived(center.inbox.value?.items.find((n) => n.id === id) ?? null);
  $effect(() => handle.setTitle(message?.title ?? 'Nachricht'));
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
    {#if message.refs.length}
      <h2>Verknüpft</h2>
      <ul class="refs">
        {#each message.refs as ref (`${ref.kind}:${ref.id}`)}
          {@const target = refWindow(ref)}
          <li>
            <Icon name={REF_ICONS[ref.kind]} small />
            <span class="muted kind">{kindLabel(ref.kind)}</span>
            <RecordLink kind={target.kind} id={target.id}>{ref.title}</RecordLink>
          </li>
        {/each}
      </ul>
    {/if}
  </Detail>
{:else}
  <Empty text="Diese Nachricht ist nicht mehr im Posteingang (älter als die letzten 100 Benachrichtigungen)." />
{/if}

<style>
  .text {
    white-space: pre-line;
  }
  .refs {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .refs li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .kind {
    min-width: 5rem;
    font-size: var(--font-size-small);
  }
</style>
