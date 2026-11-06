<script lang="ts">
  import { permissions } from '../lib/container';
  import { kindLabel } from '../features/search/model';
  import { REF_ICONS, refWindow, type LinkedRef } from '../lib/records/refs';
  import Icon from './Icon.svelte';
  import RecordLink from './RecordLink.svelte';

  /** Records linked to a message, meeting or resolution: icon, kind and title, each opening its window. */
  let { refs }: { refs: readonly LinkedRef[] } = $props();
</script>

<ul class="refs">
  {#each refs as ref (`${ref.kind}:${ref.id}`)}
    {@const target = refWindow(ref)}
    <li>
      <Icon name={REF_ICONS[ref.kind]} small />
      <span class="muted kind">{kindLabel(ref.kind)}</span>
      <RecordLink kind={target.kind} id={target.id} allowed={ref.kind !== 'MEMBER' || permissions.canSeeMember(ref.id)}>{ref.title}</RecordLink>
    </li>
  {/each}
</ul>

<style>
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
    min-width: 0;
  }
  .kind {
    min-width: 5.5rem;
    font-size: var(--font-size-small);
  }
</style>
