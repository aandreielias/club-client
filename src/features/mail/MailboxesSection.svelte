<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord } from '../../lib/detail/removeRecord';
  import { background } from '../../lib/state/background';
  import { ROLE_LABELS } from '../../lib/types';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { mailApi, mailboxes, mailCenter } from './services';

  /** Einstellungen › Postfächer (admin/board): which club address each member reads, and the shared ones per role; each opens in the window. */
  background(mailboxes.load());

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
</style>
