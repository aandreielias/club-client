<script lang="ts">
  import { settings } from '../../settings';
  import { directory, session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import Empty from '../../ui/Empty.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { TaskDetailModel } from './TaskDetailModel.svelte';
  import type { Task } from './model';

  let { task, detail }: { task: Task; detail: TaskDetailModel } = $props();

  let text = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (text.trim() && (await detail.addComment(text))) text = '';
  }
</script>

{#if task.comments.length}
  <ol class="comments">
    {#each task.comments as comment (comment.id)}
      <li>
        <div class="head">
          <span class="author">{directory.nameOf(comment.authorId)}</span>
          <time class="muted" datetime={comment.createdAt}>{session.format.dateTime(comment.createdAt)}</time>
        </div>
        <p>{comment.text}</p>
      </li>
    {/each}
  </ol>
{:else}
  <Empty text="Noch keine Kommentare." />
{/if}

<form class="stack" onsubmit={submit}>
  <Field label="Kommentar">
    <textarea bind:value={text} rows="3" maxlength={settings.tasks.commentMaxLength} required></textarea>
  </Field>
  <ErrorNote error={detail.commentAction.error} />
  <div><Button type="submit" busy={detail.commentAction.busy} disabled={!text.trim()}>Kommentieren</Button></div>
</form>

<style>
  .comments {
    display: grid;
    gap: var(--space-md);
    margin: 0 0 var(--space-lg);
    padding: 0;
    list-style: none;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: baseline;
    font-size: var(--font-size-small);
  }
  .author {
    font-weight: var(--font-weight-medium);
  }
  p {
    margin: var(--space-xs) 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
