<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import type { MailSettings } from './model';
  import { mailApi, mailboxes, mailCenter } from './services';

  /**
   * Einstellungen › Postfächer (admin/board): the club's mail domain and daily limit, then which club address each member reads and
   * the shared ones per role; each opens in the window.
   */
  const load = new Action();
  const reload = () => void load.run(() => mailboxes.load());
  reload();

  const draft = new SettingsDraft<MailSettings>({ domain: null, dailyLimit: 200, keepsMail: true });
  const settingsLoad = new Action();
  void settingsLoad.run(async () => draft.load(await mailApi.settings()));

  const rows = $derived(
    mailboxes.items.map((m) => ({
      key: m.id,
      label: m.address,
      detail: `${m.name} · ${m.memberId ? (m.memberName ?? 'Mitglied') : `alle ${ROLE_LABELS[m.role!]}`}`,
      tags: m.memberId ? [] : ['geteilt'],
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
      archive: async () => {}, // never in use: removeRecord deletes
      reload: () => mailboxes.load(),
    };
  }
</script>

<div class="stack section">
  {#if !settingsLoad.busy && !settingsLoad.error && !draft.value.keepsMail}
    <p class="banner" role="status">
      Noch kein Mail-Anbieter angebunden: E-Mails an Vereinsadressen gehen verloren, gesendete werden nicht zugestellt. Postfächer und Adressen lassen
      sich trotzdem schon anlegen.
    </p>
  {/if}
  <SettingsForm
    title="E-Mail des Vereins"
    intro="Alle Postfach-Adressen enden auf die Mail-Domain; neue Mitglieder bekommen vornamenachname@… von selbst."
    {draft}
    onsave={(value) =>
      mailApi.saveSettings({ ...value, domain: value.domain?.trim() || null }).then(async (saved) => {
        await mailboxes.load(); // a new domain gives every member without one a personal mailbox
        return saved;
      })}
  >
    {#if settingsLoad.error}
      <p class="muted small">Die Einstellungen konnten nicht geladen werden.</p>
    {:else}
      <div class="grid-2">
        <Field label="Mail-Domain" hint="Etwa mein-verein.at">
          <input
            bind:value={() => draft.value.domain ?? '', (v) => (draft.value.domain = v || null)}
            placeholder="mein-verein.at"
            autocomplete="off"
          />
        </Field>
        <Field label="Empfänger pro Tag" hint="So viele Empfänger darf ein Mitglied an einem Tag anschreiben (Schutz vor Spam).">
          <input type="number" min="1" max="10000" bind:value={draft.value.dailyLimit} class="short" />
        </Field>
      </div>
    {/if}
  </SettingsForm>

  <section class="stack">
    <h2>Postfächer</h2>
    <p class="muted small">
      Persönliche Postfächer gehören einem Mitglied, geteilte (etwa vorstand@) allen mit einer Rolle. Die E-Mails selbst bleiben beim Mail-Anbieter.
    </p>
    <SettingsList
      {rows}
      kind="mailbox"
      newLabel="Neues Postfach"
      onremove={(row) => removeRecord(bus, row, 'Postfach', ops(row.key))}
      loading={load.busy && !mailboxes.items.length}
      error={load.error}
      onretry={reload}
      emptyText="Noch keine Postfächer. Zuerst die Mail-Domain eintragen, dann Postfächer anlegen."
    />
  </section>
</div>

<style>
  .banner {
    margin: 0;
    padding: var(--space-sm) var(--space-md);
    border-left: 3px solid var(--color-warning);
    color: var(--color-warning);
  }
  p,
  h2 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
  }
  .short {
    width: 7rem;
  }
</style>
