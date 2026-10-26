<script lang="ts">
  import type { Component } from 'svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { tooltip } from '../../ui/tooltip';
  import AppearanceSection from './AppearanceSection.svelte';
  import GeneralSection from './GeneralSection.svelte';
  import SecuritySection from './SecuritySection.svelte';
  import ShortcutsSection from './ShortcutsSection.svelte';
  import SidebarSection from './SidebarSection.svelte';
  import HomeSettingsSection from './HomeSettingsSection.svelte';
  import ClubSection from './ClubSection.svelte';
  import MeetingTypesSection from '../meetings/MeetingTypesSection.svelte';
  import ResolutionRulesSection from '../meetings/ResolutionRulesSection.svelte';
  import BoardSettingsSection from '../members/BoardSettingsSection.svelte';
  import MembershipSection from '../members/MembershipSection.svelte';
  import AppointmentTypesSection from '../calendar/AppointmentTypesSection.svelte';
  import { session } from '../../lib/container';
  import { ADMIN_BOARD, type Role } from '../../lib/types';

  /** Settings in the window or on a page; `id` is the section shown first. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  type SectionId = 'appearance' | 'home' | 'sidebar' | 'shortcuts' | 'security' | 'general' | 'club' | 'meeting-types' | 'membership' | 'offices' | 'resolution-rules' | 'appointment-types';
  /** `roles`: only shown to these (club-wide settings). */
  const ALL: readonly { id: SectionId; label: string; component: Component; roles?: readonly Role[] }[] = [
    { id: 'appearance', label: 'Darstellung', component: AppearanceSection },
    { id: 'home', label: 'Startseite', component: HomeSettingsSection },
    { id: 'sidebar', label: 'Seitenleiste', component: SidebarSection },
    { id: 'shortcuts', label: 'Tastenkürzel', component: ShortcutsSection },
    { id: 'security', label: 'Sicherheit', component: SecuritySection },
    { id: 'general', label: 'Allgemein', component: GeneralSection },
    { id: 'club', label: 'Verein', component: ClubSection, roles: ADMIN_BOARD },
    { id: 'meeting-types', label: 'Sitzungsarten', component: MeetingTypesSection, roles: ADMIN_BOARD },
    { id: 'membership', label: 'Mitgliedschaft', component: MembershipSection, roles: ADMIN_BOARD },
    { id: 'offices', label: 'Funktionen', component: BoardSettingsSection, roles: ADMIN_BOARD },
    { id: 'resolution-rules', label: 'Beschlüsse', component: ResolutionRulesSection, roles: ADMIN_BOARD },
    { id: 'appointment-types', label: 'Termine', component: AppointmentTypesSection, roles: ADMIN_BOARD },
  ];
  const SECTIONS = ALL.filter((s) => !s.roles || session.hasRole(...s.roles));

  // svelte-ignore state_referenced_locally
  let current = $state<SectionId>(SECTIONS.some((s) => s.id === id) ? (id as SectionId) : 'appearance');
  const section = $derived(SECTIONS.find((s) => s.id === current)!);

  $effect(() => handle?.setTitle(`Einstellungen: ${section.label}`));

  function keydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const index = SECTIONS.findIndex((s) => s.id === current);
    const next = SECTIONS[(index + (event.key === 'ArrowDown' ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
    current = next.id;
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  }
</script>

<Detail title="Einstellungen">
  <div class="layout">
    <div class="tabs" role="tablist" aria-label="Bereiche" aria-orientation="vertical" tabindex="-1" onkeydown={keydown}>
      {#each SECTIONS as item (item.id)}
        <button id="settings-tab-{item.id}" role="tab" aria-selected={current === item.id} aria-controls="settings-panel"
          tabindex={current === item.id ? 0 : -1} class:active={current === item.id} onclick={() => (current = item.id)}
          {@attach tooltip(`Einstellungen für ${item.label} anzeigen`)}>
          {item.label}
        </button>
      {/each}
    </div>
    <div id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-{current}">
      {#key current}<section.component />{/key}
    </div>
  </div>
</Detail>

<style>
  .layout {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    gap: var(--space-xl);
    align-items: start;
  }
  .tabs {
    display: grid;
    gap: 2px;
    position: sticky;
    top: 0;
  }
  .tabs button {
    min-height: 30px;
    padding: 0 var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-align: left;
    cursor: pointer;
  }
  .tabs button:hover {
    background: var(--color-hover);
  }
  .tabs button.active {
    background: var(--color-selected);
    color: var(--color-text);
  }
  :global([data-layout='compact']) .layout,
  :global(:root[data-window='side']) .layout {
    grid-template-columns: 1fr;
  }
  :global([data-layout='compact']) .tabs,
  :global(:root[data-window='side']) .tabs {
    position: static;
    display: flex;
    flex-wrap: wrap;
  }
</style>
