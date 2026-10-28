<script lang="ts">
  import { untrack } from 'svelte';
  import { bus, directory, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { DROPPABLE } from '../../lib/records/refs';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { recordDrop } from '../../ui/recordDrop';
  import RefPicker from '../../ui/RefPicker.svelte';
  import RichTextEditor from '../../ui/RichTextEditor.svelte';
  import Select from '../../ui/Select.svelte';
  import { settings } from '../../settings';
  import { MailAddressBook } from './MailAddressBook.svelte';
  import { MailForm } from './MailForm.svelte';
  import RecipientField from './RecipientField.svelte';
  import { mailApi, mailCenter as center } from './services';

  /**
   * Writing a mail. `id`: a mailbox id (new mail from it, `-` the first one), `reply|reply-all|forward:<mailbox>:<mail>` to answer
   * or pass on a mail, `draft:<mailbox>:<mail>` to go on with a draft. Saved as a draft a moment after each change.
   */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  const limits = settings.mail;
  // svelte-ignore state_referenced_locally
  const [mode, mailboxId, mailId] = id.includes(':') ? id.split(':') : ['new', id, ''];
  const TITLES: Record<string, string> = {
    new: 'Neue E-Mail',
    forward: 'Weiterleiten',
    draft: 'Entwurf',
    reply: 'Antworten',
    'reply-all': 'Allen antworten',
  };
  const title = TITLES[mode] ?? 'Neue E-Mail';

  let form = $state<MailForm | null>(null);
  const load = new Action();
  const send = new Action();
  const book = new MailAddressBook({
    entries: () => mailApi.addressBook(),
    teams: async () => (await directory.loadTeams(), directory.teams),
    members: async (teamId) => (await directory.roster(teamId))?.entries.map((e) => e.memberId) ?? [],
  });
  void book.load();

  const boxes = $derived(center.mailboxes.value ?? []);
  const boxOf = (boxId: string) => (center.mailboxes.value ?? []).find((b) => b.id === boxId);

  void load.run(async () => {
    await center.mailboxes.load();
    if (mode === 'new') return void (form = MailForm.compose(boxOf(mailboxId) ?? boxOf(boxes[0]?.id ?? '')));
    const original = await mailApi.get(mailboxId, mailId);
    if (mode === 'draft') form = MailForm.fromDraft(original, mailboxId);
    else if (mode === 'forward') form = MailForm.forward(original, boxOf(mailboxId));
    else form = MailForm.reply(original, boxOf(mailboxId), mode === 'reply-all');
  });

  $effect(() => handle.setTitle(title));
  const senders = $derived(boxes.map((b) => ({ value: b.id, label: `${b.name} <${b.address}>` })));

  // --- drafts: saved a moment after each change, and when the window closes with changes ---
  type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'failed';
  let saveState = $state<SaveState>('idle');
  let savedAt = $state<string | null>(null);
  let sent = false;
  /** The mailbox the draft lives in; another sender moves it there. */
  let draftBox: string | null = null;
  // svelte-ignore state_referenced_locally
  let lastSaved = '';

  async function saveDraft(): Promise<void> {
    const f = form;
    if (!f || sent) return;
    const snapshot = JSON.stringify([f.mailboxId, f.toDraft()]);
    if (snapshot === lastSaved) return void (saveState = 'saved');
    saveState = 'saving';
    try {
      if (f.draftId && draftBox && draftBox !== f.mailboxId) {
        await mailApi.delete(draftBox, f.draftId);
        f.draftId = null;
      }
      const draft = await mailApi.saveDraft(f.mailboxId, f.draftId, f.toDraft());
      f.draftId = draft.id;
      draftBox = f.mailboxId;
      lastSaved = snapshot;
      savedAt = session.format.time(draft.sentAt);
      saveState = 'saved';
    } catch {
      saveState = 'failed';
    }
  }

  // The first state counts as saved: opening a mail without typing leaves no draft behind.
  $effect(() => {
    if (form && !lastSaved) {
      lastSaved = JSON.stringify([form.mailboxId, form.toDraft()]);
      draftBox = form.draftId ? form.mailboxId : null;
    }
  });

  $effect(() => {
    if (!form) return;
    const snapshot = JSON.stringify([form.mailboxId, form.toDraft()]);
    if (snapshot === untrack(() => lastSaved)) return;
    saveState = 'pending';
    const timer = setTimeout(() => void saveDraft(), limits.draftDelayMs);
    return () => {
      clearTimeout(timer);
      if (untrack(() => saveState) === 'pending') void saveDraft();
    };
  });

  function chooseSender(boxId: string) {
    const box = boxOf(boxId);
    if (box && form) form.chooseMailbox(box);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!form) return;
    form.submitted = true;
    if (!form.valid) return;
    const f = form;
    if (f.draftId && draftBox && draftBox !== f.mailboxId) f.draftId = null; // the old one is left in its mailbox's drafts
    sent = true;
    if (await send.run(() => mailApi.send(f.mailboxId, f.toMail()))) {
      bus.publish(TOAST, { text: 'E-Mail gesendet.' });
      void center.mailboxes.load();
      handle.close();
    } else sent = false;
  }

  async function discard() {
    sent = true;
    const f = form;
    if (f?.draftId && draftBox) {
      await mailApi.delete(draftBox, f.draftId).catch(() => undefined);
      bus.publish(TOAST, { text: 'Entwurf verworfen.' });
    }
    handle.close();
  }

  const status = $derived(
    saveState === 'saving' || saveState === 'pending'
      ? 'Wird als Entwurf gespeichert …'
      : saveState === 'saved' && savedAt
        ? `Entwurf gespeichert um ${savedAt}`
        : saveState === 'failed'
          ? 'Entwurf konnte nicht gespeichert werden.'
          : '',
  );
</script>

<Detail {title}>
  <ErrorNote error={load.error} />
  {#if form}
    {@const f = form}
    <!-- Records dropped onto the form are attached; dropped into the text they are linked where they were dropped. -->
    <form
      class="stack"
      onsubmit={submit}
      novalidate
      {@attach autofocus}
      {@attach recordDrop(Object.keys(DROPPABLE), (ref) => f.links.addRecord(ref))}
    >
      {#if senders.length > 1}
        <Field label="Von" error={f.error('from')}>
          <Select options={senders} bind:value={() => f.mailboxId, chooseSender} />
        </Field>
      {/if}
      <RecipientField label="An" bind:value={f.to} {book} error={f.error('to')} />
      {#if f.showCc}<RecipientField label="Cc" bind:value={f.cc} {book} error={f.error('cc')} />{/if}
      {#if f.showBcc}<RecipientField label="Bcc (für andere unsichtbar)" bind:value={f.bcc} {book} error={f.error('bcc')} />{/if}
      {#if !f.showCc || !f.showBcc}
        <div class="row more">
          {#if !f.showCc}<Button size="sm" variant="ghost" tooltip="Kopie an weitere Empfänger" onclick={() => (f.showCc = true)}>Cc</Button>{/if}
          {#if !f.showBcc}<Button
              size="sm"
              variant="ghost"
              tooltip="Blindkopie: die anderen Empfänger sehen sie nicht"
              onclick={() => (f.showBcc = true)}>Bcc</Button
            >{/if}
        </div>
      {/if}
      <Field label="Betreff" error={f.error('subject')}>
        <input bind:value={f.subject} maxlength={limits.subjectMaxLength} required />
      </Field>
      <div class="text">
        <RichTextEditor
          bind:value={f.html}
          label="Text"
          placeholder="Text schreiben. Mitglieder, Termine, Aufgaben … hierher ziehen, um sie an dieser Stelle zu verlinken."
          records
          rows={12}
        />
        {#if f.error('body')}<span class="error" role="alert">{f.error('body')}</span>{/if}
      </div>

      <RefPicker form={f.links} label="Anhängen (optional)" perKind={limits.searchPerKind} />

      <ErrorNote error={send.error} />
      <div class="row footer">
        <Button type="submit" variant="primary" icon="send" busy={send.busy}>Senden</Button>
        <Button variant="ghost" onclick={() => handle.close()}>Schließen</Button>
        <span class="muted status" aria-live="polite">{status}</span>
        <Button variant="danger" size="sm" icon="delete" tooltip="Diese E-Mail nicht senden und den Entwurf löschen" onclick={discard}
          >Verwerfen</Button
        >
      </div>
    </form>
  {/if}
</Detail>

<style>
  .more {
    margin-top: calc(-1 * var(--space-xs));
  }
  .text {
    display: grid;
    gap: var(--space-xxs);
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
  .footer {
    align-items: center;
  }
  .status {
    flex: 1;
    font-size: var(--font-size-small);
  }
</style>
