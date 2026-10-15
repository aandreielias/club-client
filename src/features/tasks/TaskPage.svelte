<script lang="ts">
  import { router } from '../../lib/container';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import TaskView from './TaskView.svelte';

  /** Full-page form of the task window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/tasks', label: 'Aufgaben' }}>
  <TaskView id={params.id} onclosed={() => router.navigate('/tasks')} />
</DetailPage>
