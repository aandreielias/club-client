<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { ZonedClock } from '../../lib/time/ZonedClock';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Select from '../../ui/Select.svelte';
  import MemberChips from './MemberChips.svelte';
  import MotionFollowUps from './MotionFollowUps.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { boardSettings, membersApi } from '../members/services';
  import { noticeText, QUORUM_LABELS, type FollowUpRule, type ResolutionAction } from './model';
  import { meetingsApi, resolutionRules } from './services';

  /** New circular vote: the motion goes to the whole board at once and runs at least the club's shortest voting time. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neuer Umlaufbeschluss');
  const earliestNow = () => session.clock.toLocal(new Date(Date.now() + resolutionRules.value.circular.minHours * 3_600_000 + 60_000));
  const earliest = earliestNow();
  let title = $state('');
  let text = $state('');
  let deadline = $state(`${ZonedClock.addDays(earliest.slice(0, 10), 1)}T20:00`);
  let submitted = $state(false);
  let action = $state<ResolutionAction>('GENERAL');
  let assignees = $state<string[]>([]);
  let followUps = $state<FollowUpRule[]>([]);
  const actionOptions = resolutionRules.forType(null).map((a) => ({ value: a, label: resolutionRules.label(a) }));
  // server: circular votes run among the board, which also carries them out.
  const board = new Resource(async () => {
    const people = new Map((await membersApi.board()).offices.filter((o) => boardSettings.isBoard(o.office)).map((o) => [o.memberId, o.name]));
    return [...people].map(([memberId, name]) => ({ memberId, name })).sort((a, b) => a.name.localeCompare(b.name));
  });
  void board.load();
  // Checked again when sending: the form may have been open for a while.
  let tooSoon = $derived(deadline < earliest);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    tooSoon = deadline < earliestNow();
    if (!title.trim() || tooSoon) return;
    await create.submit(
      async () => {
        // Created and opened in one request: a refused opening leaves no draft behind.
        const opened = await meetingsApi.createCircular(
          title.trim(),
          text.trim() || null,
          session.clock.toInstant(deadline),
          action,
          assignees,
          followUps,
        );
        return opened.id;
      },
      'resolution',
      'Umlaufbeschluss an den Vorstand verschickt.',
    );
  }
</script>

<Detail title="Neuer Umlaufbeschluss">
  <form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
    <Field label="Antrag" error={submitted && !title.trim() ? 'Antrag angeben.' : null}>
      <input bind:value={title} maxlength="200" required />
    </Field>
    <Field label="Begründung (optional)">
      <textarea bind:value={text} rows="4" maxlength="4000"></textarea>
    </Field>
    <Field
      label="Abstimmen bis"
      hint="Mindestens {noticeText(resolutionRules.value.circular.minHours)}; gültig, wenn {QUORUM_LABELS[
        resolutionRules.value.circular.quorum
      ]} des Vorstands abstimmt."
      error={submitted && tooSoon ? `Mindestens ${noticeText(resolutionRules.value.circular.minHours)} ab jetzt.` : null}
    >
      <DateTimeInput bind:value={deadline} min={earliest} required />
    </Field>
    <Field label="Art des Beschlusses" hint="Bestimmt die Aufgabe, die nach der Annahme entsteht.">
      <Select bind:value={action} options={actionOptions} />
    </Field>
    <MemberChips
      bind:value={assignees}
      candidates={board.value ?? []}
      label="Verantwortlich für die Umsetzung"
      placeholder="Verantwortlich (leer = Vorstand)"
    />
    <MotionFollowUps {action} bind:followUps />
    <ErrorNote error={create.save.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={create.save.busy}>An den Vorstand schicken</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>
