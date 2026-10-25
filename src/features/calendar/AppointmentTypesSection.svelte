<script lang="ts">
  import { bus } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { appointmentTypes } from './services';

  /** Einstellungen › Termine (admin/board): the club's kinds of appointments; each opens in the window. */
  void appointmentTypes.load().catch(() => {});

  const open = (kind: string, id: string) => bus.publish(WINDOW_OPEN, { kind, id });
</script>

<div class="stack section">
  <p class="muted">Welche Arten von Terminen es gibt, in welcher Farbe sie im Kalender stehen und ob Fahrgemeinschaften und Kabinen angeboten werden.</p>
  <ul class="types">
    {#each appointmentTypes.items as type (type.key)}
      <li>
        <button type="button" class="type" onclick={() => open('appointment-type', type.key)} {@attach tooltip(`Terminart ${type.label} öffnen`)}>
          <Tag tone={type.hue}>{type.label}</Tag>
          <span class="muted small">{[type.rides && 'Fahrgemeinschaften', type.cabins && 'Kabinen'].filter(Boolean).join(' · ') || '—'}</span>
          {#if type.archived}<Tag tone="gray">Archiviert</Tag>{/if}
        </button>
      </li>
    {/each}
  </ul>
  <div><Button onclick={() => open('appointment-type-new', '-')}>Neue Terminart</Button></div>
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
    align-items: center;
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
</style>
