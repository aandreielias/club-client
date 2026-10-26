<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { boardSettings, membersApi, membershipKinds } from './services';

  /** Einstellungen › Mitgliedschaft (admin/board): the club's kinds of membership, each opens in the window; rights of honorary members. */
  void membershipKinds.load().catch(() => {});
  void boardSettings.load().catch(() => {});

  const open = (kind: string, id: string) => bus.publish(WINDOW_OPEN, { kind, id });
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
  <ul class="kinds">
    {#each membershipKinds.items as kind (kind.key)}
      <li>
        <button type="button" class="kind" onclick={() => open('membership-kind', kind.key)} {@attach tooltip(`Mitgliedsart ${kind.label} öffnen`)}>
          <span class="name">{kind.label}</span>
          <span class="muted small">{[kind.votes && 'Stimmrecht', kind.eligible && 'wählbar'].filter(Boolean).join(' · ') || 'ohne Stimmrecht'}</span>
          {#if kind.archived}<Tag tone="gray">Archiviert</Tag>{/if}
        </button>
      </li>
    {/each}
  </ul>
  <div><Button onclick={() => open('membership-kind-new', '-')}>Neue Mitgliedsart</Button></div>

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
  .kinds {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .kind {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    width: 100%;
    min-height: 34px;
    padding: var(--space-xs) var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .kind:hover {
    background: var(--color-hover);
  }
  .name {
    font-weight: var(--font-weight-medium);
  }
</style>
