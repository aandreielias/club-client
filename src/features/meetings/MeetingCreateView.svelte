<script lang="ts">
  import { bus, directory, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import MeetingPlaceFields from './MeetingPlaceFields.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Select from '../../ui/Select.svelte';
  import { membersApi } from '../members/services';
  import AgendaItemsEditor from './AgendaItemsEditor.svelte';
  import { MeetingForm } from './MeetingForm.svelte';
  import { latestInvite, majorities } from './model';
  import { meetingPolicy as policy, meetingsApi, meetingTypes } from './services';

  /**
   * New meeting in the window: only the types the member may convene. The Tagesordnung with its Beschlüsse is entered right here; "Anlegen
   * und einladen" sends the invitation at once. Afterwards the window shows the meeting.
   */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Sitzung');
  const form = new MeetingForm(
    session.clock,
    `${session.clock.today()}T19:00`,
    meetingTypes.items.map((t) => t.label),
  );
  const kinds = new Resource(async () => {
    const [offices, types] = await Promise.all([
      membersApi.board().then((b) => b.offices.filter((o) => o.memberId === session.member.id).map((o) => o.office)),
      meetingTypes.load(),
    ]);
    return types.filter((t) => !t.archived && policy.mayConvene(t, offices)).map((t) => ({ value: t.key, label: t.label }));
  });
  void kinds.load().then(() => kinds.value?.[0] && setKind(kinds.value[0].value));

  function setKind(key: string) {
    const type = meetingTypes.get(key);
    if (type) form.setType(type);
  }

  // Who may carry a Beschluss out: every active member (admin and board load the list).
  const people = new Resource(async () =>
    (await directory.allMembers())
      .filter((m) => m.active)
      .map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de')),
  );
  void people.load();

  const deadline = $derived(form.start && form.type ? latestInvite(form.type, form.startsAt) : null);
  const late = $derived(!!deadline && deadline < new Date().toISOString());

  async function submit(event: SubmitEvent) {
    const invite = event.submitter?.hasAttribute('data-invite') ?? false;
    await create.submit(
      async () => {
        const meeting = await meetingsApi.create(form.toNew());
        if (invite) await meetingsApi.invite(meeting.id);
        return meeting.id;
      },
      'meeting',
      invite ? 'Sitzung angelegt und eingeladen.' : 'Sitzung angelegt. Einladen nicht vergessen.',
    );
  }
</script>

<Detail title="Neue Sitzung">
  <AsyncView resource={kinds}>
    {#snippet children(options)}
      {#if options.length}
        <EditorForm action={create.save} submitLabel="Anlegen" validate={form} onsubmit={submit} oncancel={() => handle.close()}>
          <Field label="Art">
            <Select bind:value={() => form.type?.key ?? '', (k) => k && setKind(k)} {options} />
          </Field>
          <Field label="Titel" error={form.error('title')}>
            <input bind:value={form.title} maxlength="120" required />
          </Field>
          {#if form.type?.needsReason}
            <Field label="Grund der Dringlichkeit" hint="Steht in der Einladung." error={form.error('urgency')}>
              <textarea bind:value={form.urgency} rows="2" maxlength="1000"></textarea>
            </Field>
          {/if}
          <div class="grid-2">
            <Field label="Beginn" error={form.error('start')}>
              <DateTimeInput bind:value={() => form.start, (v) => form.setStart(v)} required />
            </Field>
            <Field label="Ende" error={form.error('end')}>
              <DateTimeInput bind:value={form.end} min={form.start} required />
            </Field>
          </div>
          {#if deadline}
            <p class="small" class:late class:muted={!late}>
              {late ? 'Die Einladungsfrist ist für diesen Termin schon vorbei: ' : 'Einladen spätestens am '}{session.format.dateTime(deadline)}.
            </p>
          {/if}
          <MeetingPlaceFields
            bind:location={form.location}
            bind:videoUrl={form.videoUrl}
            online={form.online}
            standing={form.type?.videoUrl ?? null}
            error={form.error('videoUrl')}
          />
          <fieldset class="stack">
            <legend>Tagesordnung</legend>
            <AgendaItemsEditor
              bind:rows={form.rows}
              majorities={majorities(form.type)}
              candidates={people.value ?? []}
              today={session.clock.today()}
            />
            {#if form.error('items')}<p class="invalid" role="alert">{form.error('items')}</p>{/if}
          </fieldset>
          {#snippet actions()}
            <Button type="submit" busy={create.save.busy} disabled={late} data-invite>Anlegen und einladen</Button>
          {/snippet}
        </EditorForm>
      {:else}
        <p class="muted">Sitzungen berufen die Funktionen ein, die bei der Sitzungsart eingestellt sind.</p>
      {/if}
    {/snippet}
  </AsyncView>
</Detail>

<style>
  .late {
    color: var(--color-danger);
  }
  legend {
    color: var(--color-text);
    font-weight: var(--font-weight-bold);
  }
</style>
