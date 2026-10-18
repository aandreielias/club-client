<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import TaskView from './TaskView.svelte';

  /** Full-page form of the task window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/tasks', label: 'Aufgaben' }}>
  <TaskView id={params.id} onclosed={() => pane.navigate('/tasks')} />
</DetailPage>
