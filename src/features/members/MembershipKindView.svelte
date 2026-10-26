<script lang="ts">
  import { backStack, bus, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { ADMIN_BOARD } from '../../lib/types';
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
  let loaded = $state(false);
  let removed = false;
  void membershipKinds.load().then(() => (loaded = true), () => (loaded = true));

  const kind = $derived(membershipKinds.get(id));
  view.title(() => kind?.label);
  $effect(() => {
    if (loaded && !kind && !edit.save.busy) {
      if (!removed) view.notify('Diese Mitgliedsart gibt es nicht mehr.');
      view.leave();
    }
  });

  async function submit() {
    await edit.submit(async (form) => {
      await membersApi.saveMembershipKind(id, { ...form, label: form.label.trim() });
      await membershipKinds.load();
    }, 'Mitgliedsart gespeichert.');
  }

  async function remove(label: string) {
    await view.confirm({ title: 'Mitgliedsart löschen', message: label, confirmLabel: 'Löschen', danger: true },
      () => view.attempt(edit.save, () => edit.save.run(async () => {
        removed = true;
        await membersApi.deleteMembershipKind(id);
        await membershipKinds.load();
      })), 'Mitgliedsart gelöscht.');
  }
</script>

{#if kind}
  <Detail title={edit.form ? 'Mitgliedsart bearbeiten' : kind.label}>
    {#snippet actions()}
      {#if !edit.form && session.hasRole(...ADMIN_BOARD)}
        <Button icon="edit" onclick={() => edit.edit({ label: kind.label, votes: kind.votes, eligible: kind.eligible, sort: kind.sort, archived: kind.archived })}>Bearbeiten</Button>
        {#if !kind.inUse}<Button variant="danger" icon="delete" onclick={() => remove(kind.label)}>Löschen</Button>{/if}
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <MembershipKindEditor form={edit.form} action={edit.save} submitLabel="Speichern" canArchive oncancel={() => edit.cancel()} onsubmit={submit} />
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
