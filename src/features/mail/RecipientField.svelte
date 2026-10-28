<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import SearchSelect from '../../ui/SearchSelect.svelte';
  import { MailForm } from './MailForm.svelte';
  import type { MailAddressBook } from './MailAddressBook.svelte';

  /** To, Cc or Bcc: chosen addresses as chips (invalid ones marked), typing suggests club addresses and teams. */
  let {
    label,
    value = $bindable([]),
    book,
    error = null,
  }: { label: string; value: string[]; book: MailAddressBook; error?: string | null } = $props();

  async function pick(option: string) {
    const added = (await book.resolve(option)).filter((a) => !value.includes(a));
    if (!added.length && option.startsWith('team:')) return bus.publish(TOAST, { text: 'In diesem Team hat niemand eine Vereins-Adresse.' });
    value = [...value, ...added];
  }
</script>

<div class="field">
  <span class="label">{label}</span>
  <div class="chips">
    {#each value as address (address)}
      <span class="chip" class:invalid={!MailForm.valid(address)}>
        {address}
        <Button size="sm" variant="ghost" icon="close" tooltip="{address} entfernen" onclick={() => (value = value.filter((a) => a !== address))} />
      </span>
    {/each}
    <span class="input">
      <SearchSelect
        search={(query) => book.suggest(query, value)}
        onpick={(option) => void pick(option)}
        placeholder={value.length ? '' : 'Name, Adresse oder Team'}
        aria-label={label}
        emptyText="Keine Vereins-Adresse gefunden. Eine vollständige Adresse eintippen."
      />
    </span>
  </div>
  {#if error}<span class="message error" role="alert">{error}</span>{/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-xxs);
  }
  .label {
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xxs);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xxs);
    padding-left: var(--space-sm);
    border-radius: var(--radius-full);
    background: var(--color-hover);
    font-size: var(--font-size-small);
  }
  .chip.invalid {
    color: var(--color-danger);
    text-decoration: wavy underline;
  }
  .input {
    flex: 1;
    min-width: 12rem;
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
