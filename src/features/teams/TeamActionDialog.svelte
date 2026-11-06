<script lang="ts">
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import type { RosterEntry, Team } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { TeamForm } from './TeamForm.svelte';
  import { teamsApi } from './services';

  /**
   * The small team dialogs: a player's number/position/captaincy (`player`), the next season with the same roster (`season`), or a
   * coach's request to add someone (`request`).
   */
  let {
    kind,
    team,
    entry = null,
    ondone,
    onclose,
  }: {
    kind: 'player' | 'season' | 'request';
    team: Team;
    entry?: RosterEntry | null;
    ondone: (result: unknown) => void;
    onclose: () => void;
  } = $props();

  const action = new Action();
  // svelte-ignore state_referenced_locally
  let jersey = $state<number | ''>(entry?.jersey ?? '');
  // svelte-ignore state_referenced_locally
  let position = $state(entry?.position ?? '');
  // svelte-ignore state_referenced_locally
  let captain = $state(!!entry?.captain);
  /** The season after the team's: 2026/27 → 2027/28 (or after the current one when the team's is older). */
  function following(current: string): string {
    const first =
      Math.max(
        Number(current.slice(0, 4)),
        Number(TeamForm.currentSeason(session.clock.today(), session.club?.seasonStartMonth ?? 7).slice(0, 4)) - 1,
      ) + 1;
    return `${first}/${String((first + 1) % 100).padStart(2, '0')}`;
  }
  // svelte-ignore state_referenced_locally
  let season = $state(following(team.season));
  let note = $state('');

  const titles = $derived({ player: `Spieler:in: ${entry?.name ?? ''}`, season: 'Neue Saison', request: 'Spieler:in anfragen' });
  const valid = $derived(
    kind === 'player'
      ? jersey === '' || (Number.isInteger(jersey) && jersey >= 0 && jersey <= 99)
      : kind === 'season'
        ? /^\d{4}\/\d{2}$/.test(season)
        : !!note.trim(),
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!valid) return;
    const result = await action.attempt<unknown>(() =>
      kind === 'player'
        ? teamsApi.setPlayerInfo(team.id, entry!.memberId, { jersey: jersey === '' ? null : jersey, position: position.trim() || null, captain })
        : kind === 'season'
          ? teamsApi.copy(team.id, season.trim())
          : teamsApi.requestPlayer(team.id, null, note.trim()).then(() => true),
    );
    if (result) ondone(result);
  }
</script>

<Dialog open title={titles[kind]} {onclose}>
  <form class="stack" onsubmit={submit}>
    {#if kind === 'player'}
      <div class="grid-2">
        <Field label="Nummer" hint="0 bis 99">
          <input type="number" min="0" max="99" bind:value={jersey} class="short" />
        </Field>
        <Field label="Position">
          <input bind:value={position} maxlength="40" placeholder="z.B. Zuspiel" />
        </Field>
      </div>
      <label class="check"><input type="checkbox" bind:checked={captain} /> Kapitän:in (ersetzt die bisherige)</label>
    {:else if kind === 'season'}
      <p>„{team.name}“ mit allen Mitgliedern, Nummern und Positionen für eine neue Saison anlegen. Das alte Team bleibt; archiviere es danach.</p>
      <Field label="Saison" hint="Etwa 2027/28">
        <input bind:value={season} maxlength="7" required />
      </Field>
    {:else}
      <p>Vorstand und Admins bekommen deine Anfrage und nehmen die Person auf. Trainer:innen fügen selbst niemanden hinzu.</p>
      <Field label="Wer?" hint="Name, und wie die Person erreichbar ist.">
        <textarea bind:value={note} rows="3" maxlength="500" required></textarea>
      </Field>
    {/if}
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy} disabled={!valid}
        >{kind === 'player' ? 'Speichern' : kind === 'season' ? 'Saison anlegen' : 'Anfrage senden'}</Button
      >
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  p {
    margin: 0;
  }
</style>
