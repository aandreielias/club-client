<script lang="ts">
  import { backStack, bus, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { ADMIN_BOARD } from '../../lib/types';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import MembershipKindEditor from './MembershipKindEditor.svelte';
  import type { MembershipKindInput } from './MembersApi';
  import { membersApi, membershipKinds } from './services';

  /** One membership kind; admin and board edit it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<MembershipKindInput>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(view, membershipKinds, () => id, 'Diese Mitgliedsart gibt es nicht mehr.', () => edit.save.busy);
  const kind = $derived(stored.record);
  view.title(() => kind?.label);

  async function submit() {
    await edit.submit((form) => stored.saved(() => membersApi.saveMembershipKind(id, { ...form, label: form.label.trim() })), 'Mitgliedsart gespeichert.');
  }

  function remove(label: string) {
    void stored.remove(label, 'Mitgliedsart löschen', 'Mitgliedsart gelöscht.', edit.save, () => membersApi.deleteMembershipKind(id));
  }
</script>

{#if kind}
  <Detail title={edit.form ? 'Mitgliedsart bearbeiten' : kind.label}>
    {#snippet actions()}
      {#if !edit.form && session.hasRole(...ADMIN_BOARD)}
        <Button icon="edit" onclick={() => edit.edit({ label: kind.label, votes: kind.votes, eligible: kind.eligible, sort: kind.sort, archived: kind.archived })}>Bearbeiten</Button>
        {#if !kind.inUse && !kind.fixed}<Button variant="danger" icon="delete" onclick={() => remove(kind.label)}>Löschen</Button>{/if}
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <MembershipKindEditor form={edit.form} action={edit.save} submitLabel="Speichern" canArchive={!kind.fixed} oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Stimmrecht</dt><dd>{kind.votes ? 'in der Mitgliederversammlung' : 'keines'}</dd>
        <dt>Wählbar</dt><dd>{kind.eligible ? 'in eine Funktion' : 'nein'}</dd>
        <dt>Verwendet</dt><dd>{kind.inUse ? 'Mitglieder haben diese Art.' : 'Noch niemand.'}{#if kind.archived} <Tag tone="gray">Archiviert</Tag>{/if}</dd>
      </dl>
    {/if}
  </Detail>
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
