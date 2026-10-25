<script lang="ts">
  /** Board size warnings (too few people, an even number): shown in red. */
  const SIZE_WARNINGS = ['board.too-small', 'board.even'];
  import { bus, directory, permissions, session } from '../../lib/container';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { CONFIRM, TOAST } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { canVote } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Page from '../../ui/Page.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { BoardModel } from './BoardModel.svelte';
  import { boardWarning } from './messages';
  import type { Office, OfficeKind } from './MembersApi';
  import { boardSettings, memberPolicy as policy, membersApi } from './services';

  /** Vorstand and Rechnungsprüfer: who holds which function, until when. */
  const model = new BoardModel(membersApi);
  void model.load();

  const today = session.clock.today();
  const candidates = new Resource(() => directory.allMembers());
  if (policy.canManageOffices()) void candidates.load();
  const officeOptions = $derived(boardSettings.enabled.map((kind) => ({ value: kind, label: boardSettings.label(kind) })));

  let memberId = $state('');
  let office = $state<OfficeKind | ''>('');
  let startsOn = $state(today);
  let termEndsOn = $state('');
  let coopted = $state(false);

  /** server: canVote — only extraordinary and honorary members may be elected. */
  const memberOptions = $derived(
    (candidates.value ?? []).filter(canVote).map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` })),
  );

  async function assign(event: SubmitEvent) {
    event.preventDefault();
    if (!memberId || !office) return;
    const assigned = await model.assign({ memberId, office, startsOn, termEndsOn: termEndsOn || null, coopted });
    if (!assigned) return;
    bus.publish(TOAST, { text: `${boardSettings.label(assigned.office)}: ${assigned.name}.` });
    if (assigned.memberId === session.member.id) await session.loadMe();
    memberId = '';
    office = '';
    termEndsOn = '';
    coopted = false;
  }

  async function end(o: Office) {
    const ok = await bus.request(CONFIRM, {
      title: 'Funktion beenden',
      message: `${o.name} ist ab heute nicht mehr ${boardSettings.label(o.office)}.${o.office === 'AUDITOR' ? '' : ' Die Vorstandsrolle endet mit der letzten Funktion im Vorstand.'}`,
      confirmLabel: 'Beenden',
      danger: true,
    });
    if (!ok || !(await model.end(o.id))) return;
    bus.publish(TOAST, { text: 'Funktion beendet.' });
    if (o.memberId === session.member.id) await session.loadMe();
  }
</script>

{#snippet list(offices: Office[], empty: string)}
  <ul class="offices">
    {#each offices as o (o.id)}
      <li>
        <span class="function">{boardSettings.label(o.office)}</span>
        <span><RecordLink kind="member" id={o.memberId} allowed={permissions.canSeeMember(o.memberId)}>{o.name}</RecordLink>{#if o.coopted} <Tag tone="orange">Kooptiert</Tag>{/if}</span>
        <span class="muted small">{session.format.date(o.startsOn)} bis {session.format.date(o.termEndsOn)}</span>
        {#if policy.canManageOffices()}
          <Button size="sm" variant="ghost" busy={model.endAction.busy} onclick={() => end(o)}>Beenden</Button>
        {/if}
      </li>
    {:else}
      <li class="muted">{empty}</li>
    {/each}
  </ul>
{/snippet}

<Page title="Vorstand">
  <AsyncView resource={model.board}>
    {#snippet children(board)}
      {#if board.warnings.length}
        <ul class="warnings">
          {#each board.warnings as code (code)}<li class:danger={SIZE_WARNINGS.includes(code)}><Icon name="alert" small /> {boardWarning(code, boardSettings.value)}</li>{/each}
        </ul>
      {/if}
      {@render list(board.offices.filter((o) => o.office !== 'AUDITOR'), 'Noch keine Funktionen eingetragen.')}
      <h2>Rechnungsprüfung</h2>
      {@render list(board.offices.filter((o) => o.office === 'AUDITOR'), 'Noch keine Rechnungsprüfer:innen eingetragen.')}
      <ErrorNote error={model.endAction.error} />
    {/snippet}
  </AsyncView>

  {#if policy.canManageOffices()}
    <h2>Funktion vergeben</h2>
    <form class="stack" onsubmit={assign}>
      <div class="grid">
        <Field label="Mitglied" hint="Nur außerordentliche und Ehrenmitglieder sind wählbar.">
          <Select bind:value={memberId} placeholder="Bitte wählen" options={memberOptions} />
        </Field>
        <Field label="Funktion">
          <Select bind:value={office} placeholder="Bitte wählen" options={officeOptions} />
        </Field>
        <Field label="Beginn">
          <DateInput bind:value={startsOn} max={today} required />
        </Field>
        <Field label="Ende der Funktionsperiode (optional)" hint="Leer = drei Jahre nach Beginn.">
          <DateInput bind:value={termEndsOn} min={startsOn} />
        </Field>
      </div>
      <label class="check"><input type="checkbox" bind:checked={coopted} /> Kooptiert, bis die nächste Mitgliederversammlung bestätigt</label>
      <ErrorNote error={model.assignAction.error} />
      <div><Button type="submit" variant="primary" busy={model.assignAction.busy} disabled={!memberId || !office}>Funktion vergeben</Button></div>
    </form>
  {/if}
</Page>

<style>
  .offices {
    display: grid;
    margin: 0 0 var(--space-md);
    padding: 0;
    list-style: none;
  }
  .offices li {
    display: grid;
    grid-template-columns: 10rem minmax(0, 1fr) auto auto;
    gap: var(--space-md);
    align-items: center;
    min-height: var(--control-height);
    border-bottom: 1px solid var(--color-border);
  }
  .function {
    font-weight: var(--font-weight-medium);
  }
  .warnings {
    display: grid;
    gap: var(--space-xs);
    margin: 0 0 var(--space-md);
    padding: 0;
    list-style: none;
    color: var(--color-text-muted);
  }
  .warnings .danger {
    color: var(--color-danger);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-md);
  }
  :global([data-layout='compact']) .offices li {
    grid-template-columns: 1fr auto;
  }
</style>
