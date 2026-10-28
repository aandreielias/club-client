import { describe, expect, it } from 'vitest';
import { MailForm, textToHtml } from './MailForm.svelte';
import type { Mail, Mailbox } from './model';

const received: Mail = {
  id: 'm1',
  folder: 'INBOX',
  from: 'anna@club.at',
  fromName: 'Anna',
  to: ['me@club.at', 'bob@club.at'],
  cc: ['carl@club.at'],
  bcc: [],
  subject: 'Training',
  body: 'Zeile 1\nZeile 2',
  html: null,
  sentAt: '2026-10-01T10:00:00Z',
  read: true,
  refs: [],
};
const box = (signature: string | null, id = 'box'): Mailbox => ({
  id,
  address: 'me@club.at',
  name: 'Ich',
  kind: 'PERSONAL',
  unread: 0,
  signature,
  signatureEditable: true,
});

describe('MailForm', () => {
  it('starts a new mail with the signature below "-- "', () => {
    expect(MailForm.compose(box('<p>Gruß</p>')).html).toBe('<p></p><p>-- </p><p>Gruß</p>');
    expect(MailForm.compose(box(null)).html).toBe('');
  });

  it('prefills a reply with the sender, AW: and the quoted text', () => {
    const form = MailForm.reply(received, box(null));
    expect(form.mailboxId).toBe('box');
    expect(form.to).toEqual(['anna@club.at']);
    expect(form.cc).toEqual([]);
    expect(form.subject).toBe('AW: Training');
    expect(form.html).toContain('schrieb Anna &lt;anna@club.at&gt;:</p><blockquote><p>Zeile 1<br>Zeile 2</p></blockquote>');
    expect(MailForm.reply({ ...received, subject: 'aw: Training' }, box(null)).subject).toBe('aw: Training');
  });

  it('reply to all copies the others, not the own address', () => {
    const form = MailForm.reply(received, box(null), true);
    expect(form.cc).toEqual(['bob@club.at', 'carl@club.at']);
    expect(form.showCc).toBe(true);
  });

  it('forwards with WG: and the original, without recipients', () => {
    const form = MailForm.forward({ ...received, html: '<p><b>Formatiert</b></p>' }, box(null));
    expect(form.to).toEqual([]);
    expect(form.subject).toBe('WG: Training');
    expect(form.html).toContain('Weitergeleitete Nachricht');
    expect(form.html).toContain('<p><b>Formatiert</b></p>');
  });

  it('swaps the signature with the sender while the text is untouched', () => {
    const form = MailForm.reply(received, box('<p>Alt</p>'));
    form.chooseMailbox(box('<p>Neu</p>', 'other'));
    expect(form.mailboxId).toBe('other');
    expect(form.html).toMatch(/^<p><\/p><p>-- <\/p><p>Neu<\/p><p>Am /);
    form.html = '<p>Getippt</p>';
    form.chooseMailbox(box('<p>Alt</p>'));
    expect(form.html).toBe('<p>Getippt</p>');
  });

  it('restores a draft with its recipients and attached records', () => {
    const draft: Mail = {
      ...received,
      folder: 'DRAFTS',
      to: ['x'],
      bcc: ['b@c.at'],
      html: '<p>E</p>',
      refs: [{ kind: 'TEAM', id: 't', title: 'Damen', parentId: null }],
    };
    const form = MailForm.fromDraft(draft, 'box');
    expect(form.draftId).toBe('m1');
    expect(form.showBcc).toBe(true);
    expect(form.toDraft()).toEqual({
      to: ['x'],
      cc: ['carl@club.at'],
      bcc: ['b@c.at'],
      subject: 'Training',
      html: '<p>E</p>',
      refs: [{ kind: 'TEAM', id: 't' }],
    });
  });

  it('checks addresses only when sending, and drops duplicates', () => {
    const form = MailForm.compose(box(null));
    form.to = ['a@b.at'];
    form.cc = ['a@b.at', 'c@d.at'];
    form.bcc = ['c@d.at', 'e@f.at'];
    form.subject = ' Hallo ';
    expect(form.toMail()).toMatchObject({ to: ['a@b.at'], cc: ['c@d.at'], bcc: ['e@f.at'], subject: 'Hallo', draftId: null });
    expect(form.valid).toBe(true);
    form.to = ['kein-adresse'];
    expect(form.errors.to).toBeDefined();
    form.to = [];
    expect(form.errors.to).toBe('Mindestens einen Empfänger angeben.');
    expect(MailForm.addresses('A@b.at; c@d.at,  a@b.at')).toEqual(['a@b.at', 'c@d.at']);
  });

  it('turns plain text into paragraphs, escaped', () => {
    expect(textToHtml('a <b>\nzwei\n\ndrei')).toBe('<p>a &lt;b&gt;<br>zwei</p><p>drei</p>');
  });
});
