<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import { DROPPABLE } from '../../lib/records/refs';
  import type { RecordRef } from '../../lib/records/RecordDrag';
  import { autofocus } from '../../ui/autofocus';
  import { recordDrop } from '../../ui/recordDrop';
  import RefPicker from '../../ui/RefPicker.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { settings } from '../../settings';
  import { MailForm } from './MailForm.svelte';
  import { mailApi, mailCenter as center } from './services';

  /**
   * Writing a mail. `id`: a mailbox id (new mail from it), or `reply|reply-all|forward:<mailbox>:<mail>`
   * to prefill from a received mail.
   */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  const limits = settings.mail;
  // svelte-ignore state_referenced_locally
  const [mode, mailboxId, mailId] = id.includes(':') ? id.split(':') : ['new', id, ''];
  let form = $state<MailForm | null>(null);
  const load = new Action();
  const send = new Action();

  void load.run(async () => {
    if (mode === 'new') {
      const f = new MailForm();
      f.mailboxId = mailboxId === '-' ? (center.mailboxes.value?.[0]?.id ?? '') : mailboxId;
      form = f;
      return;
    }
    const original = await mailApi.get(mailboxId, mailId);
    form = mode === 'forward' ? MailForm.forward(original, mailboxId) : MailForm.reply(original, mailboxId, mode === 'reply-all');
  });

  $effect(() => handle.setTitle(mode === 'forward' ? 'Weiterleiten' : mode === 'new' ? 'Neue E-Mail' : 'Antworten'));
  const senders = $derived((center.mailboxes.value ?? []).map((b) => ({ value: b.id, label: `${b.name} <${b.address}>` })));

  let textarea: HTMLTextAreaElement | undefined = $state();

  /** A record dropped into the text goes where it was dropped (where the browser can tell), else to the cursor. */
  function dropIntoText(record: RecordRef, event: DragEvent) {
    if (!form || !textarea) return;
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const at = point?.offsetNode === textarea ? point.offset : textarea.selectionStart;
    const caret = form.insertRecord(record, at);
    if (caret === null) return;
    const field = textarea;
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(caret, caret);
    });
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!form) return;
    form.submitted = true;
    if (!form.valid) return;
    const f = form;
    if (await send.run(() => mailApi.send(f.mailboxId, f.toMail()))) {
      bus.publish(TOAST, { text: 'E-Mail gesendet.' });
      void center.mailboxes.load();
      handle.close();
    }
  }
</script>

<Detail title={mode === 'forward' ? 'Weiterleiten' : mode === 'new' ? 'Neue E-Mail' : 'Antworten'}>
  <ErrorNote error={load.error} />
  {#if form}
    {@const f = form}
    <!-- Records dropped onto the form are attached; dropped into the text they go where they were dropped. -->
    <form
      class="stack"
      onsubmit={submit}
      novalidate
      {@attach autofocus}
      {@attach recordDrop(Object.keys(DROPPABLE), (ref) => f.links.addRecord(ref))}
    >
      {#if senders.length > 1}
        <Field label="Von" error={form.error('from')}>
          <Select options={senders} bind:value={form.mailboxId} />
        </Field>
      {/if}
      <Field label="An" hint="Mehrere Adressen mit Komma trennen." error={form.error('to')}>
        <input type="text" inputmode="email" autocomplete="off" bind:value={form.to} required />
      </Field>
      <Field label="Cc (optional)" error={form.error('cc')}>
        <input type="text" inputmode="email" autocomplete="off" bind:value={form.cc} />
      </Field>
      <Field label="Betreff" error={form.error('subject')}>
        <input bind:value={form.subject} maxlength={limits.subjectMaxLength} required />
      </Field>
      <Field label="Text" hint="Mitglieder, Termine, Aufgaben … hierher ziehen, um sie an dieser Stelle zu verlinken." error={form.error('body')}>
        <textarea
          bind:this={textarea}
          bind:value={form.body}
          rows="12"
          maxlength={limits.bodyMaxLength}
          {@attach recordDrop(Object.keys(DROPPABLE), dropIntoText)}></textarea>
      </Field>

      <RefPicker form={form.links} label="Anhängen (optional)" perKind={limits.searchPerKind} />

      <ErrorNote error={send.error} />
      <div class="row">
        <Button type="submit" variant="primary" icon="send" busy={send.busy}>Senden</Button>
        <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
      </div>
    </form>
  {/if}
</Detail>
