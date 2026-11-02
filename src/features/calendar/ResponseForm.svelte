<script lang="ts">
  import { settings } from '../../settings';
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import { RESPONSE_OPTIONS, type ResponseStatus } from './model';

  /** The answer for oneself or, for guardians, one of their minors in the team (`respondents`, oneself first). */
  let { detail, respondents }: { detail: AppointmentDetailModel; respondents: { id: string; name: string }[] } = $props();

  // svelte-ignore state_referenced_locally
  let memberId = $state(respondents[0]?.id ?? '');
  let status = $state<ResponseStatus | null>(null);
  let reason = $state('');
  const entry = $derived(detail.entryOf(memberId));
  const person = $derived(respondents.find((r) => r.id === memberId));
  const self = $derived(person?.name === 'Ich');

  // The fields follow the chosen person's current answer; the form owns them until the next choice.
  let shownFor = '';
  $effect(() => {
    if (memberId === shownFor) return;
    shownFor = memberId;
    status = entry?.absent ? null : (entry?.status ?? null);
    reason = entry?.reason ?? '';
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (status && (await detail.respond(status, reason, memberId))) bus.publish(TOAST, { text: 'Antwort gespeichert.' });
  }
</script>

<form class="stack" onsubmit={submit}>
  {#if respondents.length > 1}
    <Field label="Für">
      <Select bind:value={memberId} options={respondents.map((r) => ({ value: r.id, label: r.name }))} />
    </Field>
  {/if}
  {#if entry?.absent}
    <p class="muted note">
      {self ? 'Du bist' : `${person?.name} ist`} an diesem Tag abwesend gemeldet; der Termin zählt als „Nein“. Mit einer Antwort änderst du das.
    </p>
  {:else if entry?.unconfirmed}
    <p class="note warn">Die Zeit hat sich geändert. Bitte die Antwort bestätigen oder ändern.</p>
  {/if}
  <ChoiceGroup name="response" label="Antwort" options={RESPONSE_OPTIONS} bind:value={status} />
  <Field label="Begründung (optional)" hint="Sehen nur Trainer:innen des Teams, Vorstand und Admins.">
    <input bind:value={reason} maxlength={settings.calendar.reasonMaxLength} />
  </Field>
  <ErrorNote error={detail.respondAction.error} />
  <div>
    <Button type="submit" variant="primary" busy={detail.respondAction.busy} disabled={!status}
      >{entry?.unconfirmed ? 'Antwort bestätigen' : 'Antwort speichern'}</Button
    >
  </div>
</form>

<style>
  .note {
    margin: 0;
  }
  .warn {
    color: var(--color-warning);
  }
</style>
