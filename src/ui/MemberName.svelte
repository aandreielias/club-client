<script lang="ts">
  import { NAVIGATE } from '../channels';
  import { bus, directory, permissions, session } from '../lib/container';
  import RecordLink from './RecordLink.svelte';
  import Tag from './Tag.svelte';

  /**
   * A member's name; opens the profile when the viewer may see it (own name: Mein Konto for members
   * without a profile window). Unknown members show the generic placeholder.
   */
  let { memberId, tag = false }: { memberId: string; tag?: boolean } = $props();

  const self = $derived(memberId === session.member.id);
  const toAccount = $derived(self && !permissions.isPrivileged);
</script>

{#snippet name()}
  {#if tag}<Tag tone="gray">{directory.nameOf(memberId)}</Tag>{:else}{directory.nameOf(memberId)}{/if}
{/snippet}

<RecordLink
  kind="member"
  id={memberId}
  allowed={toAccount || permissions.canSeeMember(memberId)}
  hint={toAccount ? 'Mein Konto öffnen' : 'Profil öffnen'}
  onopen={toAccount ? () => bus.publish(NAVIGATE, { path: '/account' }) : undefined}
>
  {@render name()}
</RecordLink>
