<script lang="ts">
  import { bus, commands, session } from '../../lib/container';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { auditActions } from './actions';
  import { CONFIRM } from '../../channels';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import { settings } from '../../settings';
  import { financeApi } from './services';

  /**
   * One Kassenprüfung with its report (`id` '-' = confirm a new one: auditors and admins). Confirming locks every booking up to
   * the date; only a Storno corrects them then. Window only.
   */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const isNew = id === '-';
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  // svelte-ignore state_referenced_locally
  const create = isNew ? new CreateController(bus, handle, 'Kassenprüfung bestätigen') : null;
  // svelte-ignore state_referenced_locally
  const audit = new Resource(() => financeApi.audit(id));
  // svelte-ignore state_referenced_locally
  const list = new Resource(() => financeApi.audits());
  if (isNew) void list.load();
  else void audit.load();
  view.title(() => audit.value?.title);

  // server: AuditHandlers.confirm — after the last check, before today (a Storno today stays possible).
  const yesterday = (() => {
    const d = new Date(`${session.clock.today()}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  let checkedUntil = $state(yesterday);
  let note = $state('');
  let submitted = $state(false);
  const last = $derived(list.value?.checkedUntil ?? null);
  const dateOk = $derived(!!checkedUntil && checkedUntil <= yesterday && (!last || checkedUntil > last));
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
    },
    get valid() {
      return dateOk;
    },
  };

  async function submit() {
    const confirmed = await bus.request(CONFIRM, {
      title: 'Kassenprüfung bestätigen',
      message: `Alle Buchungen bis ${session.format.date(checkedUntil)} gelten dann als geprüft und lassen sich nur mehr per Storno korrigieren.`,
      confirmLabel: 'Bestätigen',
    });
    if (!confirmed) return;
    await create!.submit(async () => (await financeApi.confirmAudit(checkedUntil, note.trim() || null)).id, 'audit', 'Kassenprüfung bestätigt.');
  }

  const act = useRecordActions(
    commands,
    auditActions,
    () => (isNew ? null : audit.value),
    () => handle.close(),
  );
</script>

{#if isNew}
  <Detail title="Kassenprüfung bestätigen">
    <EditorForm action={create!.save} submitLabel="Bestätigen" oncancel={() => handle.close()} onsubmit={submit} validate={check}>
      <Field
        label="Geprüft bis"
        note={last ? `Letzte Prüfung bis ${session.format.date(last)}.` : 'Noch keine Prüfung.'}
        error={submitted && !dateOk ? 'Ein Tag vor heute und nach der letzten Prüfung.' : null}
      >
        <input type="date" bind:value={checkedUntil} min={last ?? undefined} max={yesterday} required />
      </Field>
      <Field label="Ergebnis">
        <textarea bind:value={note} maxlength={settings.finance.noteMaxLength} rows="4"></textarea>
      </Field>
    </EditorForm>
  </Detail>
{:else}
  <AsyncView resource={audit}>
    {#snippet children(a)}
      <Detail title={a.title}>
        {#snippet actions()}
          <RecordActionButtons actions={act} />
        {/snippet}
        <dl class="props">
          <dt>Geprüft bis</dt>
          <dd>{session.format.date(a.checkedUntil)}</dd>
          <dt>Bestätigt</dt>
          <dd>
            {session.format.dateTime(a.createdAt)}{#if a.createdBy}, <MemberName memberId={a.createdBy} />{/if}
          </dd>
        </dl>
        {#if a.note}<p class="prose">{a.note}</p>{/if}
      </Detail>
    {/snippet}
  </AsyncView>
{/if}
