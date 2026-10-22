<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Page from '../../ui/Page.svelte';
  import { isImportant, NOTIFICATION_KINDS } from './model';
  import { PreferencesModel } from './PreferencesModel.svelte';
  import { notificationsApi } from './services';

  const model = new PreferencesModel(notificationsApi);
  void model.load();

  async function save() {
    if (await model.save()) bus.publish(TOAST, { text: 'Einstellungen gespeichert.' });
  }
</script>

<Page title="Benachrichtigungen einstellen" back={{ href: '/notifications', label: 'Benachrichtigungen' }}>
  <p class="muted">Im Posteingang erscheint jede Benachrichtigung. Hier legst du fest, was zusätzlich per Push (App) und per E-Mail kommt.</p>

  <AsyncView resource={model.stored}>
    {#snippet children()}
      <table>
        <thead>
          <tr>
            <th scope="col">Art</th>
            <th scope="col">Push (App)</th>
            <th scope="col">E-Mail</th>
          </tr>
        </thead>
        <tbody>
          {#each NOTIFICATION_KINDS as kind (kind.value)}
            {@const preference = model.preference(kind.value)}
            {#if preference}
              <tr>
                <th scope="row">
                  <span>{kind.label}</span>
                  <span class="muted hint">{kind.hint}</span>
                </th>
                <td>
                  <input type="checkbox" aria-label="{kind.label}: Push" checked={preference.push}
                    disabled={isImportant(kind.value)} onchange={(e) => model.set(kind.value, 'push', e.currentTarget.checked)} />
                </td>
                <td>
                  <input type="checkbox" aria-label="{kind.label}: E-Mail" checked={preference.email}
                    disabled={isImportant(kind.value)} onchange={(e) => model.set(kind.value, 'email', e.currentTarget.checked)} />
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
      <ErrorNote error={model.saveAction.error} />
      <div class="actions">
        <Button variant="primary" busy={model.saveAction.busy} disabled={!model.dirty} onclick={save}>Speichern</Button>
      </div>
    {/snippet}
  </AsyncView>
</Page>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: var(--space-sm);
    border-bottom: 1px solid var(--color-border);
    text-align: left;
    vertical-align: top;
  }
  thead th {
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
  }
  tbody th {
    font-weight: var(--font-weight-medium);
  }
  tbody th span {
    display: block;
  }
  td {
    width: 7rem;
  }
  .hint {
    font-size: var(--font-size-small);
    font-weight: normal;
  }
  .actions {
    margin-top: var(--space-lg);
  }
</style>
