import { describe, expect, it } from 'vitest';
import { MailForm } from './MailForm.svelte';
import type { Mail } from './model';

const received: Mail = {
  id: 'm1',
  folder: 'INBOX',
  from: 'anna@club.at',
  fromName: 'Anna',
  to: ['me@club.at', 'bob@club.at'],
  cc: ['carl@club.at'],
  subject: 'Training',
  body: 'Zeile 1\nZeile 2',
  sentAt: '2026-10-01T10:00:00Z',
  read: true,
};

describe('MailForm', () => {
  it('prefills a reply with the sender, AW: and the quoted text', () => {
    const form = MailForm.reply(received, 'box');
    expect(form.mailboxId).toBe('box');
    expect(form.to).toBe('anna@club.at');
    expect(form.cc).toBe('');
    expect(form.subject).toBe('AW: Training');
    expect(form.body).toContain('> Zeile 1\n> Zeile 2');
    expect(MailForm.reply({ ...received, subject: 'aw: Training' }, 'box').subject).toBe('aw: Training');
  });

  it('reply to all copies the other recipients', () => {
    expect(MailForm.reply(received, 'box', true).cc).toBe('me@club.at, bob@club.at, carl@club.at');
  });

  it('forwards with WG: and the original text, without recipients', () => {
    const form = MailForm.forward(received, 'box');
    expect(form.to).toBe('');
    expect(form.subject).toBe('WG: Training');
    expect(form.body).toContain('Weitergeleitete Nachricht');
    expect(form.body).toContain('Zeile 1\nZeile 2');
  });

  it('splits, cleans and checks addresses', () => {
    const form = new MailForm();
    form.mailboxId = 'box';
    form.to = 'A@b.at; c@d.at,  a@b.at';
    form.cc = 'c@d.at e@f.at';
    form.subject = ' Hallo ';
    expect(form.toMail()).toEqual({ to: ['a@b.at', 'c@d.at'], cc: ['e@f.at'], subject: 'Hallo', body: '', refs: [] });
    expect(form.valid).toBe(true);
    form.to = 'kein-adresse';
    expect(form.errors.to).toBeDefined();
    form.to = '';
    expect(form.errors.to).toBe('Mindestens einen Empfänger angeben.');
  });
});

describe('MailForm links', () => {
  const task = { kind: 'task', id: '11111111-2222-3333-4444-555555555555', title: 'Bälle holen' };

  it('puts a dropped record into the text where it was dropped, with spaces around it', () => {
    const form = new MailForm();
    form.body = 'Bitte erledigen.';
    const caret = form.insertRecord(task, 'Bitte'.length);
    expect(form.body).toBe(`Bitte [Bälle holen](club:task/${task.id}) erledigen.`);
    expect(caret).toBe(form.body.indexOf(' erledigen'));
    expect(form.insertRecord({ kind: 'resolution', id: 'r', title: 'x' }, 0)).toBeNull();
  });

  it('sends attached records as refs', () => {
    const form = new MailForm();
    form.links.addRecord(task);
    form.links.addRecord({ kind: 'file', id: 'folder:file-1', title: 'Plan.pdf' });
    expect(form.toMail().refs).toEqual([
      { kind: 'TASK', id: task.id },
      { kind: 'FILE', id: 'file-1' },
    ]);
  });
});
