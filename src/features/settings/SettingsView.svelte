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
  import AuditSection from './AuditSection.svelte';
  import { session } from '../../lib/container';
  import Icon from '../../ui/Icon.svelte';
  import { LAST_TAB, tabPath, visibleSettings, type SectionId, type SettingsTab } from './settingsTree';

  /** Settings in the window or on a page; `id` is the section shown first. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  const COMPONENTS: Record<SectionId, Component> = {
    appearance: AppearanceSection, home: HomeSettingsSection, sidebar: SidebarSection, shortcuts: ShortcutsSection, security: SecuritySection,
    general: GeneralSection, club: ClubSection, 'meeting-types': MeetingTypesSection, membership: MembershipSection, offices: BoardSettingsSection,
    'resolution-rules': ResolutionRulesSection, 'appointment-types': AppointmentTypesSection, audit: AuditSection,
  };
  const { groups, tabs } = visibleSettings((roles) => session.hasRole(...roles));

  // svelte-ignore state_referenced_locally
  let current = $state<SectionId>(tabs.some((t) => t.id === id) ? (id as SectionId) : 'appearance');
  /** Collapsed groups; the one holding the current tab starts open. */
  let collapsed = $state<Record<string, boolean>>(
    // svelte-ignore state_referenced_locally
    Object.fromEntries(groups.map((g) => [g.id, !g.subgroups.some((s) => s.tabs.some((t) => t.id === current))])),
  );
  const visible = $derived(tabs.filter((t) => !groups.some((g) => collapsed[g.id] && g.subgroups.some((s) => s.tabs.includes(t)))));

  $effect(() => handle?.setTitle(`Einstellungen: ${tabPath(current)}`));

  function choose(next: SettingsTab) {
    current = next.id;
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  }

  /** Up and down walk the visible tabs; left and right close and open the group of the focused one. */
  function keydown(event: KeyboardEvent) {
    const index = visible.findIndex((t) => t.id === current);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      choose(visible[(index + (event.key === 'ArrowDown' ? 1 : visible.length - 1)) % visible.length]);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const group = groups.find((g) => g.subgroups.some((s) => s.tabs.some((t) => t.id === current)));
      if (!group) return;
      event.preventDefault();
      collapsed[group.id] = event.key === 'ArrowLeft';
      if (collapsed[group.id]) document.getElementById(`settings-group-${group.id}`)?.focus();
    }
  }
</script>

{#snippet tab(item: SettingsTab)}
  <button id="settings-tab-{item.id}" role="tab" aria-selected={current === item.id} aria-controls="settings-panel"
    tabindex={current === item.id ? 0 : -1} class:active={current === item.id} onclick={() => (current = item.id)}
    {@attach tooltip(`Einstellungen für ${item.label} anzeigen`)}>
    {item.label}
  </button>
{/snippet}

<Detail title="Einstellungen">
  <div class="layout">
    <!-- Arrow keys bubble up from the tab buttons. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav class="tabs" aria-label="Bereiche" onkeydown={keydown}>
      {#each groups as group (group.id)}
        <button id="settings-group-{group.id}" class="group" aria-expanded={!collapsed[group.id]} onclick={() => (collapsed[group.id] = !collapsed[group.id])}
          {@attach tooltip(`${group.label} ${collapsed[group.id] ? 'aufklappen' : 'zuklappen'}`)}>
          <Icon name={group.icon} small /><span>{group.label}</span><span class="chevron" class:open={!collapsed[group.id]}><Icon name="next" small /></span>
        </button>
        {#if !collapsed[group.id]}
          {#each group.subgroups as sub (sub.label)}
            <div class="sub" role="tablist" aria-label="{group.label}: {sub.label}" aria-orientation="vertical">
              {#if sub.tabs.length > 1}<span class="sub-label" aria-hidden="true">{sub.label}</span>{/if}
              {#each sub.tabs as item (item.id)}{@render tab(item)}{/each}
            </div>
          {/each}
        {/if}
      {/each}
      <div class="sub last" role="tablist" aria-label="Allgemein">{@render tab(LAST_TAB)}</div>
    </nav>
    <div id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-{current}">
      {#key current}{@const Section = COMPONENTS[current]}<Section />{/key}
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
    display: flex;
    align-items: center;
    gap: var(--space-xs);
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
  .tabs .group {
    margin-top: var(--space-sm);
    color: var(--color-text);
  }
  .tabs .group:first-child {
    margin-top: 0;
  }
  .chevron {
    display: inline-flex;
    margin-left: auto;
    transition: transform var(--motion-fast) var(--motion-easing);
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .sub {
    display: grid;
    gap: 2px;
    padding-left: var(--space-md);
  }
  .sub-label {
    padding: var(--space-xs) var(--space-sm) 0;
    color: var(--color-text-faint);
    font-size: var(--font-size-small);
  }
  .last {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    padding-left: 0;
    border-top: 1px solid var(--color-border);
  }
  :global([data-layout='compact']) .layout,
  :global(:root[data-window='side']) .layout {
    grid-template-columns: 1fr;
  }
  :global([data-layout='compact']) .tabs,
  :global(:root[data-window='side']) .tabs {
    position: static;
  }
  :global([data-layout='compact']) .sub,
  :global(:root[data-window='side']) .sub {
    display: flex;
    flex-wrap: wrap;
  }
</style>
