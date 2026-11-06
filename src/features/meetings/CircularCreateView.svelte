<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { ZonedClock } from '../../lib/time/ZonedClock';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import MemberChips from './MemberChips.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { noticeText, QUORUM_LABELS } from './model';
  import { activePeople } from './people';
  import { meetingsApi, resolutionRules } from './services';

  /**
   * New circular vote: the motion goes to the whole board at once and runs at least the club's shortest voting time. Once passed, whoever
   * is named (nobody: the Vorstand) gets the task "<Titel> umsetzen", due on the chosen day.
   */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neuer Umlaufbeschluss');
  const earliestNow = () => session.clock.toLocal(new Date(Date.now() + resolutionRules.value.circular.minHours * 3_600_000 + 60_000));
  const earliest = earliestNow();
  let title = $state('');
  let text = $state('');
  let deadline = $state(`${ZonedClock.addDays(earliest.slice(0, 10), 1)}T20:00`);
  let submitted = $state(false);
  let assignees = $state<string[]>([]);
  let implementDue = $state('');
  const people = new Resource(activePeople);
  void people.load();
  // Checked again when sending: the form may have been open for a while.
  let tooSoon = $derived(deadline < earliest);
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
      tooSoon = deadline < earliestNow();
    },
    get valid() {
      return !!title.trim() && !tooSoon;
    },
  };

  async function submit() {
    await create.submit(
      async () => {
        // Created and opened in one request: a refused opening leaves no draft behind.
        const opened = await meetingsApi.createCircular(
          title.trim(),
          text.trim() || null,
          session.clock.toInstant(deadline),
          assignees,
          implementDue || null,
        );
        return opened.id;
      },
      'resolution',
      'Umlaufbeschluss an den Vorstand verschickt.',
    );
  }
</script>

<Detail title="Neuer Umlaufbeschluss">
  <EditorForm action={create.save} submitLabel="An den Vorstand schicken" validate={check} onsubmit={submit} oncancel={() => handle.close()}>
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
    <MemberChips bind:value={assignees} candidates={people.value ?? []} label="Umsetzung durch" placeholder="Umsetzung durch (sonst Vorstand)" />
    <Field label="Umsetzen bis (optional)" hint="Fälligkeit der Aufgabe, wenn der Beschluss angenommen ist.">
      <DateInput bind:value={implementDue} min={session.clock.today()} />
    </Field>
  </EditorForm>
</Detail>
