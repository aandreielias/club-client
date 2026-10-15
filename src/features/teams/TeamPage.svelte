<script lang="ts">
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import TeamView from './TeamView.svelte';

  /** Full-page form of the team window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/teams', label: 'Teams' }}>
  <TeamView id={params.id} />
</DetailPage>
