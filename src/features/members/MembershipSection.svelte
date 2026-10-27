<script lang="ts">
  import { background } from '../../lib/state/background';
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { boardSettings, membersApi, membershipKinds } from './services';

  /** Einstellungen › Mitgliedschaft (admin/board): the club's kinds of membership, each opens in the window; rights of honorary members. */
  background(membershipKinds.load());
  background(boardSettings.load());

  const rows = $derived(membershipKinds.items.map((k) => ({
    key: k.key, label: k.label, archived: k.archived,
    detail: [k.votes && 'Stimmrecht', k.eligible && 'wählbar'].filter(Boolean).join(' · ') || 'ohne Stimmrecht',
  })));
  const action = new Action();

  async function setHonoraryVotes(on: boolean) {
    const settings = boardSettings.value;
    if (!settings) return;
    if (await action.run(async () => (boardSettings.value = await membersApi.saveBoardSettings({ ...settings, honoraryVotes: on })))) {
      bus.publish(TOAST, { text: 'Gespeichert.' });
    }
  }
</script>

<div class="stack section">
  <p class="muted">Welche Arten der Mitgliedschaft es gibt und wer in der Mitgliederversammlung abstimmt und in eine Funktion gewählt werden kann.</p>
  <SettingsList {rows} kind="membership-kind" newLabel="Neue Mitgliedsart" />

  <h3>Ehrenmitglieder</h3>
  <label class="check">
    <input type="checkbox" checked={boardSettings.value?.honoraryVotes ?? true} disabled={!boardSettings.value || action.busy}
      onchange={(e) => setHonoraryVotes(e.currentTarget.checked)} />
    Ehrenmitglieder haben Stimmrecht und können gewählt werden
  </label>
  <ErrorNote error={action.error} />
</div>

<style>
  p,
  h3 {
    margin: 0;
  }
</style>
