<script lang="ts">
  import { backStack, bus, commands, permissions } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { membershipKindActions } from './actions';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
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
  const stored = new StoredRecord(
    view,
    membershipKinds,
    () => id,
    'Diese Mitgliedsart gibt es nicht mehr.',
    () => edit.save.busy,
  );
  const kind = $derived(stored.record);
  view.title(() => kind?.label);

  async function submit() {
    await edit.submit(
      (form) => stored.saved(() => membersApi.saveMembershipKind(id, { ...form, label: form.label.trim() })),
      'Mitgliedsart gespeichert.',
    );
  }

  const act = useRecordActions(
    commands,
    membershipKindActions,
    () => (edit.form ? null : kind),
    () => view.leave(),
  );
  useCommands(commands, {
    'record.edit': {
      run: () => kind && edit.edit({ label: kind.label, votes: kind.votes, eligible: kind.eligible, sort: kind.sort, archived: kind.archived }),
      when: () => !edit.form && !!kind && permissions.isManager,
    },
  });
</script>

{#if kind}
  <Detail title={edit.form ? 'Mitgliedsart bearbeiten' : kind.label}>
    {#snippet meta()}
      {#if kind.fixed}<Tag tone="blue">fest</Tag>{/if}
      {#if kind.archived}<Tag tone="gray">Archiviert</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      <RecordActionButtons actions={act} />
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <MembershipKindEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Stimmrecht</dt>
        <dd>{kind.votes ? 'in der Mitgliederversammlung' : 'keines'}</dd>
        <dt>Wählbar</dt>
        <dd>{kind.eligible ? 'in eine Funktion' : 'nein'}</dd>
        <dt>Verwendet</dt>
        <dd>{kind.inUse ? 'Mitglieder haben diese Art.' : 'Noch niemand.'}</dd>
        {#if kind.fixed}
          <dt>Vergeben</dt>
          <dd>durch Beschluss (Ehrenmitgliedschaft verleihen oder aberkennen)</dd>{/if}
      </dl>
    {/if}
  </Detail>
{:else}
  <DetailSkeleton />
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
