<script lang="ts">
  import { background } from '../../lib/state/background';
  import { untrack } from 'svelte';
  import { settings } from '../../settings';
  import { bus, directory, permissions, session, store } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { PersonListModel } from '../../lib/directory/PersonListModel.svelte';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import { autofocus } from '../../ui/autofocus';
  import { recordDrop } from '../../ui/recordDrop';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import PeoplePicker from '../../ui/PeoplePicker.svelte';
  import TeamPicker from '../../ui/TeamPicker.svelte';
  import { DROPPABLE, MessageForm, type Audience } from './MessageForm.svelte';
  import RefPicker from '../../ui/RefPicker.svelte';
  import { notificationsApi } from './services';

  /** Writing a message: recipients (everyone, teams or people), text and linked records. Admin, board and coaches. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const limits = settings.notifications.message;
  const form = new MessageForm(permissions.isManager);
  const send = new Action();

  const audiences: { value: Audience; label: string }[] = [
    ...(permissions.isManager ? [{ value: 'everyone' as const, label: 'Alle' }] : []),
    { value: 'teams', label: 'Teams' },
    { value: 'people', label: 'Personen' },
  ];

  if (permissions.isManager) background(directory.loadTeams());
  const teams = new TeamListModel(async () => [...permissions.manageableTeams()], session, null, 'message-teams');
  void teams.load();
  const people = new PersonListModel(
    async () => {
      await directory.loadRosters();
      if (permissions.isManager) return directory.candidates(null);
      // Coaches write to members of the teams they coach.
      const rosters = await Promise.all(permissions.manageableTeams().map((t) => directory.candidates(t.id)));
      return [...new Map(rosters.flat().map((p) => [p.memberId, p])).values()].filter((p) => p.memberId !== session.member.id);
    },
    directory,
    (id) => form.memberIds.includes(id),
    store,
    'message-people',
  );
  void people.load();

  // How many people the message reaches, asked from the server (same rules as sending).
  let reach = $state<number | null>(null);
  // Only the recipients matter: typing the title or text must not ask the server again.
  const recipients = $derived.by(() => {
    const { everyone, teamIds, memberIds, includeGuardians } = form.toMessage();
    return JSON.stringify({ everyone, teamIds, memberIds, includeGuardians });
  });
  $effect(() => {
    void recipients;
    if (!form.hasTargets) return void (reach = null);
    let current = true; // a slow older answer must not overwrite a newer one
    const timer = setTimeout(() => {
      notificationsApi.preview(untrack(() => form.toMessage())).then(
        (n) => current && (reach = n),
        () => current && (reach = null),
      );
    }, limits.previewDebounceMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    let count = 0;
    if (await send.run(async () => (count = await notificationsApi.send(form.toMessage())))) {
      bus.publish(TOAST, { text: count === 1 ? 'Nachricht an 1 Person gesendet.' : `Nachricht an ${count} Personen gesendet.` });
      handle.close();
    }
  }
</script>

<Detail title="Nachricht senden">
  <!-- Records dragged in from anywhere (the other split pane, a list, a name) are linked. -->
  <form class="stack" onsubmit={submit} novalidate {@attach autofocus} {@attach recordDrop(Object.keys(DROPPABLE), (ref) => form.addRecord(ref))}>
    <fieldset class="stack">
      <legend>An</legend>
      <ChoiceGroup name="message-audience" label="Empfänger" options={audiences} bind:value={form.audience} />
      {#if form.audience === 'teams'}
        <TeamPicker list={teams} chosen={form.teamIds} ontoggle={(id) => form.toggleTeam(id)} error={form.error('recipients')} />
      {:else if form.audience === 'people'}
        <PeoplePicker list={people} chosen={form.memberIds} ontoggle={(id) => form.toggleMember(id)} emptyText="Keine passenden Mitglieder." />
        {#if form.error('recipients')}<span class="error" role="alert">{form.error('recipients')}</span>{/if}
      {:else}
        <p class="muted">Alle aktiven Mitglieder des Vereins.</p>
      {/if}
      {#if form.audience !== 'everyone'}
        <label class="check"><input type="checkbox" bind:checked={form.includeGuardians} /> Eltern von Minderjährigen lesen mit</label>
      {/if}
      <p class="reach muted" aria-live="polite">
        {#if reach !== null}Erreicht {reach === 1 ? '1 Person' : `${reach} Personen`}.{/if}
      </p>
    </fieldset>

    <Field label="Titel" error={form.error('title')}>
      <input bind:value={form.title} maxlength={limits.titleMaxLength} required />
    </Field>
    <Field label="Text (optional)" error={form.error('body')}>
      <textarea bind:value={form.body} rows="5" maxlength={limits.bodyMaxLength}></textarea>
    </Field>

    <RefPicker form={form.links} perKind={settings.notifications.message.searchPerKind} />

    <ErrorNote error={send.error} />
    <div class="row">
      <Button type="submit" variant="primary" icon="send" busy={send.busy}>Senden</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .reach {
    min-height: 1lh;
    margin: 0;
    font-size: var(--font-size-small);
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
