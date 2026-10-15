<script lang="ts">
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import SettingsView from './SettingsView.svelte';

  /** Settings as a full page ('/settings' or '/settings/<section>'). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/', label: 'Start' }}>
  <SettingsView id={params.section ?? 'appearance'} />
</DetailPage>
