<script lang="ts">
  import { backStack, bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { settings } from '../../settings';
  import type { AccountInput } from './model';
  import { accounts, financeApi, financeMay, money } from './services';

  /** One account of the Buchhaltung (`id` '-' = new); WRITE holders name, archive or delete it. Window only. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const isNew = id === '-';
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  const edit = new EditSession<AccountInput>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const create = isNew ? new CreateController(bus, handle, 'Neues Konto') : null;
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    accounts,
    () => id,
    'Dieses Konto gibt es nicht mehr.',
    () => edit.save.busy || isNew,
  );
  const account = $derived(stored.record);
  view.title(() => (isNew ? undefined : account?.label));
  const blank = $state<AccountInput>({ label: '', sort: 10, archived: false });
  const form = $derived(isNew ? blank : edit.form);
  let submitted = $state(false);
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
    },
    get valid() {
      return !!form?.label.trim();
    },
  };

  async function submit() {
    if (isNew) {
      await create!.submit(
        async () => {
          const saved = await financeApi.saveAccount(null, { ...blank, label: blank.label.trim() });
          await accounts.load();
          return saved.key;
        },
        'finance-account',
        'Konto angelegt.',
      );
    } else {
      await edit.submit((f) => stored.saved(() => financeApi.saveAccount(id, { ...f, label: f.label.trim() })), 'Konto gespeichert.');
    }
  }

  async function setArchived(archived: boolean) {
    if (await edit.save.run(() => stored.saved(() => accounts.ops(id).archive(archived))))
      view.notify(archived ? 'Konto archiviert.' : 'Konto wiederhergestellt.');
  }
</script>

{#snippet editor(f: AccountInput)}
  <EditorForm
    action={create?.save ?? edit.save}
    submitLabel={isNew ? 'Anlegen' : 'Speichern'}
    oncancel={() => (isNew ? handle.close() : edit.cancel())}
    onsubmit={submit}
    validate={check}
  >
    <Field
      label="Bezeichnung"
      error={submitted && !f.label.trim() ? `Bezeichnung mit 1 bis ${settings.finance.labelMaxLength} Zeichen angeben.` : null}
    >
      <input bind:value={f.label} maxlength={settings.finance.labelMaxLength} required />
    </Field>
  </EditorForm>
{/snippet}

{#if isNew}
  <Detail title="Neues Konto">{@render editor(blank)}</Detail>
{:else if account}
  <Detail title={edit.form ? 'Konto bearbeiten' : account.label}>
    {#snippet meta()}
      {#if account.archived}<Tag tone="gray">Archiviert</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      {#if !edit.form && financeMay('WRITE')}
        <Button icon="edit" onclick={() => edit.edit({ label: account.label, sort: account.sort, archived: account.archived })}>Bearbeiten</Button>
        {#if account.archived}
          <Button tooltip="Wieder für neue Buchungen anbieten" onclick={() => setArchived(false)}>Wiederherstellen</Button>
        {:else if account.inUse}
          <Button tooltip="Für neue Buchungen nicht mehr anbieten; bestehende behalten es" onclick={() => setArchived(true)}>Archivieren</Button>
        {:else}
          <Button
            variant="danger"
            icon="delete"
            onclick={() => stored.remove(account.label, 'Konto löschen', 'Konto gelöscht.', edit.save, () => financeApi.deleteAccount(id))}
            >Löschen</Button
          >
        {/if}
      {/if}
    {/snippet}

    {#if form}
      <div class="editing" {@attach edit.track}>{@render editor(form)}</div>
    {:else}
      <dl class="props">
        <dt>Kontostand</dt>
        <dd>{money(account.balanceCents)}</dd>
        <dt>Verwendet</dt>
        <dd>{account.inUse ? 'Es gibt Buchungen auf diesem Konto.' : 'Noch keine Buchungen.'}</dd>
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
