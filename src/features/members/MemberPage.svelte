<script lang="ts">
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import MemberView from './MemberView.svelte';
  import { memberPolicy as policy } from './services';

  /** Full-page form of the member window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={policy.isManager ? { href: '/members', label: 'Mitglieder' } : { href: '/teams', label: 'Teams' }}>
  <MemberView id={params.id} />
</DetailPage>
