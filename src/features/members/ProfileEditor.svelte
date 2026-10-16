<script lang="ts">
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import type { Member } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { MemberDetailModel } from './MemberDetailModel.svelte';
  import { ProfileForm } from './MemberForms.svelte';

  let { member, model, ondone }: { member: Member; model: MemberDetailModel; ondone: () => void } = $props();

  const today = session.clock.today();
  // svelte-ignore state_referenced_locally
  const form = new ProfileForm(member, today);
  const max = settings.members.nameMaxLength;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    const patch = form.toPatch();
    if (!Object.keys(patch).length || (await model.saveProfile(patch))) {
      bus.publish(TOAST, { text: 'Profil gespeichert.' });
      ondone();
    }
  }
</script>

<form class="stack" onsubmit={submit} novalidate>
  <div class="grid">
    <Field label="Vorname" error={form.error('firstName')}>
      <input bind:value={form.firstName} maxlength={max} required />
    </Field>
    <Field label="Nachname" error={form.error('lastName')}>
      <input bind:value={form.lastName} maxlength={max} required />
    </Field>
    <Field label="Geburtsdatum" hint={member.birthDate ? undefined : 'Für dich nicht sichtbar oder noch nicht eingetragen.'} error={form.error('birthDate')}>
      <input type="date" bind:value={form.birthDate} max={today} min={settings.members.earliestBirthDate} />
    </Field>
    <Field label="Telefon" error={form.error('phone')}>
      <input type="tel" bind:value={form.phone} maxlength={settings.profile.phoneMaxLength} />
    </Field>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={form.photoConsent} />
    Foto-Einwilligung liegt vor
  </label>
  <ErrorNote error={model.profileAction.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={model.profileAction.busy}>Speichern</Button>
    <Button variant="ghost" onclick={ondone}>Abbrechen</Button>
  </div>
</form>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-md);
  }
</style>
