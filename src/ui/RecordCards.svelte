<script lang="ts" module>
  import type { IconName } from '../icons';
  import type { RecordRef } from '../lib/records/RecordDrag';
  import type { TagTone } from './Tag.svelte';

  /** One record as a card: opens its page, can be dragged onto what links it. */
  export interface RecordCard {
    href: string;
    record: RecordRef;
    icon: IconName;
    /** Purple instead of the accent colour, e.g. for board meetings. */
    altIcon?: boolean;
    /** A second, smaller line under the name. */
    detail?: string;
    /** Date and figures; hidden in the compact layout. */
    meta: string;
    tag: { tone: TagTone; label: string };
  }
</script>

<script lang="ts">
  import { RecordDrag } from '../lib/records/RecordDrag';
  import Icon from './Icon.svelte';
  import Tag from './Tag.svelte';

  /** Meetings, tournaments and other records as a list of cards. */
  let { cards }: { cards: readonly RecordCard[] } = $props();
</script>

<ul class="cards">
  {#each cards as card (card.record.id)}
    <li>
      <a href={card.href} ondragstart={(e) => RecordDrag.set(e, card.record)}>
        <span class="icon" class:alt={card.altIcon}><Icon name={card.icon} /></span>
        <span class="name">{card.record.title}{#if card.detail}<span class="muted small detail">{card.detail}</span>{/if}</span>
        <span class="muted meta">{card.meta}</span>
        <Tag tone={card.tag.tone}>{card.tag.label}</Tag>
      </a>
    </li>
  {/each}
</ul>

<style>
  .cards {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  a {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-fast) var(--motion-easing), background var(--motion-fast) var(--motion-easing);
  }
  a:hover {
    border-color: var(--color-border-strong);
    background: var(--color-hover);
  }
  .icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  .icon.alt {
    background: var(--color-tag-purple-bg);
    color: var(--color-tag-purple-text);
  }
  .name {
    display: grid;
    overflow: hidden;
    font-weight: var(--font-weight-medium);
  }
  .name,
  .detail {
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    overflow: hidden;
    font-weight: normal;
  }
  :global(:root[data-layout='compact']) a {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  :global(:root[data-layout='compact']) .meta {
    display: none;
  }
</style>
