<script lang="ts">
  import { bus } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { noticeText } from './model';
  import { meetingTypes } from './services';

  /** Einstellungen › Sitzungsarten (admin/board): the club's meeting types; each opens in the window. */
  void meetingTypes.load().catch(() => {});

  const open = (kind: string, id: string) => bus.publish(WINDOW_OPEN, { kind, id });
</script>

<div class="stack section">
  <p class="muted">
    Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung
    beschlussfähig ist und was sie beschließen darf. Die Vorgaben entsprechen den Statuten.
  </p>
  <ul class="types">
    {#each meetingTypes.items as type (type.key)}
      <li>
        <button type="button" class="type" onclick={() => open('meeting-type', type.key)} {@attach tooltip(`${type.label} öffnen`)}>
          <span class="name">{type.label}</span>
          <span class="muted small">
            {type.electorate === 'ASSEMBLY' ? 'Mitglieder' : 'Vorstand'} · Frist {noticeText(type.noticeHours)}{type.dueBy ? ' · jährlich' : ''}
          </span>
          {#if type.archived}<Tag tone="gray">Archiviert</Tag>{/if}
        </button>
      </li>
    {/each}
  </ul>
  <div><Button onclick={() => open('meeting-type-new', '-')}>Neue Sitzungsart</Button></div>
</div>

<style>
  p {
    margin: 0;
  }
  .types {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .type {
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
  .type:hover {
    background: var(--color-hover);
  }
  .name {
    font-weight: var(--font-weight-medium);
  }
</style>
