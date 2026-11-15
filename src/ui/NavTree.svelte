<script lang="ts" module>
  import type { IconName } from '../icons';

  /** A row of a navigation tree: a leaf, or a group with `children`. */
  export interface TreeItem<T> {
    key: string;
    label: string;
    icon?: IconName;
    children?: T[];
  }
</script>

<script lang="ts" generics="T extends TreeItem<T>">
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import { motion } from '../lib/container';
  import Icon from './Icon.svelte';
  import NavTree from './NavTree.svelte';
  import { tooltip } from './tooltip';

  /**
   * The rows of a tree as `<li>`s (the caller gives the `<ul>`): groups are collapsible sections, each level indented; `leaf` renders
   * each entry. Without `isOpen` every group is open and its heading is a plain label (sidebar flyout). `closed` adds to the
   * heading of a closed group (e.g. the badges of its entries); `onslide` runs when a group starts opening or closing.
   */
  let {
    items,
    leaf,
    closed,
    isOpen,
    ontoggle,
    onslide,
  }: {
    items: readonly T[];
    leaf: Snippet<[T]>;
    closed?: Snippet<[T]>;
    isOpen?: (key: string) => boolean;
    ontoggle?: (key: string) => void;
    onslide?: () => void;
  } = $props();
</script>

{#each items as item (item.key)}
  {#if item.children}
    {@const open = !isOpen || isOpen(item.key)}
    <li class="branch" data-branch={item.key}>
      {#if isOpen}
        <button
          class="head"
          data-head={item.key}
          aria-expanded={open}
          onclick={() => ontoggle?.(item.key)}
          {@attach tooltip(`${item.label} ${open ? 'zuklappen' : 'aufklappen'}`)}
        >
          {#if item.icon}<Icon name={item.icon} small />{/if}
          <span class="label">{item.label}</span>
          {#if !open}{@render closed?.(item)}{/if}
          <span class="chevron" class:open><Icon name="next" small /></span>
        </button>
      {:else}
        <span class="head" aria-hidden="true"><span class="label">{item.label}</span></span>
      {/if}
      {#if open}
        <ul aria-label={item.label} transition:slide={{ duration: motion.ms('base') }} onintrostart={onslide} onoutrostart={onslide}>
          <NavTree items={item.children} {leaf} {closed} {isOpen} {ontoggle} {onslide} />
        </ul>
      {/if}
    </li>
  {:else}
    <li>{@render leaf(item)}</li>
  {/if}
{/each}

<style>
  li {
    list-style: none;
  }
  ul {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0 0 0 var(--space-md);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    width: 100%;
    min-height: 28px;
    padding: 0 var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-faint);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
    text-align: left;
  }
  button.head {
    cursor: pointer;
  }
  .head .label {
    flex: 1;
  }
  button.head:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }
  .chevron {
    display: inline-flex;
    margin-left: auto;
    transition: transform var(--motion-fast) var(--motion-easing);
  }
  .chevron.open {
    transform: rotate(90deg);
  }
</style>
