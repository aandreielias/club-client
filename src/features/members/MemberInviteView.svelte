<script lang="ts">
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { InviteForm } from './MemberForms.svelte';
  import RoleChecklist from './RoleChecklist.svelte';
  import { memberPolicy as policy, membersApi } from './services';

  /** Invitation of a new member in the window; afterwards the window shows the new member. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const today = session.clock.today();
  const form = new InviteForm(today);
  const action = new Action();
  const max = settings.members.nameMaxLength;

  $effect(() => handle.setTitle('Mitglied einladen'));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    let invited = '';
    if (await action.run(async () => (invited = (await membersApi.invite(form.toInvitation())).id))) {
      bus.publish(TOAST, { text: 'Einladung verschickt.' });
      handle.open('member', invited);
    }
  }
</script>

<Detail title="Mitglied einladen">
  <p class="muted">Die Person bekommt eine E-Mail mit einem Link, über den sie ihr Passwort festlegt.</p>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="E-Mail" error={form.error('email')}>
      <input type="email" bind:value={form.email} autocomplete="off" required />
    </Field>
    <div class="grid-2">
      <Field label="Vorname" error={form.error('firstName')}>
        <input bind:value={form.firstName} maxlength={max} required />
      </Field>
      <Field label="Nachname" error={form.error('lastName')}>
        <input bind:value={form.lastName} maxlength={max} required />
      </Field>
    </div>
    <Field label="Geburtsdatum (optional)" hint="Sonst fragt die Website beim ersten Anmelden danach." error={form.error('birthDate')}>
      <input type="date" bind:value={form.birthDate} max={today} min={settings.members.earliestBirthDate} />
    </Field>
    <RoleChecklist bind:value={form.roles} allowed={policy.grantableRoles()} legend="Rollen" />
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>Einladen</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>
