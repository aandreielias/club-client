<script lang="ts">
  import { session } from '../../lib/container';
  import Page from '../../ui/Page.svelte';
  import type { PageProps } from '../Feature';
  import { SETTINGS_SECTIONS } from './sections';
  import { tabPath, visibleSettings, type SectionId } from './settingsTree';

  /** Einstellungen as a page ('/settings/<section>'): the sidebar shows the settings tree, the page only the section. */
  let { params }: PageProps = $props();

  const { tabs } = visibleSettings((roles) => session.hasRole(...roles));
  const tab = $derived(tabs.find((t) => t.id === params.section) ?? tabs[0]);
  const Section = $derived(SETTINGS_SECTIONS[tab.id as SectionId]);
  const group = $derived(tabPath(tab.id).split(' › ').slice(0, -1).join(' › '));
</script>

<Page title={tab.label}>
  {#snippet context()}
    <span class="muted small">Einstellungen{group ? ` › ${group}` : ''}</span>
  {/snippet}
  {#key tab.id}<Section />{/key}
</Page>
