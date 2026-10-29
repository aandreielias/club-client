<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import { background } from '../../lib/state/background';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { mailApi, mailboxes, mailCenter } from './services';

  /** Einstellungen › Postfächer (admin/board): which club address each member reads, and the shared ones per role; each opens in the window. */
  background(mailboxes.load());

  // The club's mail domain and daily limit, above the list.
  const settings = new Resource(() => mailApi.settings());
  let domain = $state('');
  let dailyLimit = $state(200);
  void settings.load().then(() => {
    domain = settings.value?.domain ?? '';
    dailyLimit = settings.value?.dailyLimit ?? 200;
  });
  const save = new Action();
  async function saveSettings(event: SubmitEvent) {
    event.preventDefault();
    if (await save.run(async () => settings.set(await mailApi.saveSettings({ domain: domain.trim() || null, dailyLimit })))) {
      bus.publish(TOAST, { text: 'E-Mail-Einstellungen gespeichert.' });
    }
  }

  const rows = $derived(
    mailboxes.items.map((m) => ({
      key: m.id,
      label: m.address,
      detail: `${m.name} · ${m.memberId ? (m.memberName ?? 'Mitglied') : `alle ${ROLE_LABELS[m.role!]}`}`,
      archived: false,
      inUse: false,
    })),
  );

  function ops(id: string) {
    return {
      delete: async () => {
        await mailApi.deleteMailbox(id);
        await mailCenter.mailboxes.load();
      },
      archive: async () => {}, // mailboxes are never archived
      reload: () => mailboxes.load(),
    };
  }
</script>

<div class="stack section">
  <p class="muted">
    Welche Vereins-Adresse wer in der App liest: persönliche Postfächer gehören einem Mitglied, geteilte (etwa vorstand@) allen mit einer Rolle. Die
    E-Mails selbst bleiben beim Mail-Anbieter.
  </p>
  <form class="stack settings" onsubmit={saveSettings}>
    <div class="grid-2">
      <Field
        label="Mail-Domain des Vereins"
        hint="Alle Postfach-Adressen enden darauf, etwa mein-verein.at. Neue Mitglieder bekommen vornamenachname@…"
      >
        <input bind:value={domain} placeholder="mein-verein.at" autocomplete="off" />
      </Field>
      <Field label="Empfänger pro Tag" hint="So viele Empfänger darf ein Mitglied an einem Tag anschreiben (Schutz vor Spam).">
        <input type="number" min="1" max="10000" bind:value={dailyLimit} class="short" />
      </Field>
    </div>
    <ErrorNote error={save.error} />
    <div><Button type="submit" busy={save.busy}>Speichern</Button></div>
  </form>

  <SettingsList
    {rows}
    kind="mailbox"
    newLabel="Neues Postfach"
    onremove={(row) => removeRecord(bus, row, 'Postfach', ops(row.key))}
    onrestore={() => {}}
  />
</div>

<style>
  p {
    margin: 0;
  }
  .settings {
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }
  .short {
    width: 7rem;
  }
</style>
