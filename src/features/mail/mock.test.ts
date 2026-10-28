import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import { mockServer } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { notifications } from '../notifications/mock';
import { mail } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const own = (id: string) => mail.list(member(id)).find((b) => b.kind === 'PERSONAL')!;
const shared = (id: string) => mail.list(member(id)).find((b) => b.kind === 'SHARED');

describe('mock mail', () => {
  it('shows the own mailbox, and the shared board mailbox only to the board', () => {
    expect(own('spieler').address).toBe('david.spieler@mein-verein.at');
    expect(shared('spieler')).toBeUndefined();
    expect(shared('vorstand')?.address).toBe('vorstand@mein-verein.at');
    expect(() => mail.folder(member('spieler'), shared('vorstand')!.id, 'INBOX')).toThrow(
      expect.objectContaining({ code: 'mail.mailbox-not-found' }),
    );
    expect(() => mail.folder(member('trainer'), own('spieler').id, 'INBOX')).toThrow(expect.objectContaining({ code: 'mail.mailbox-not-found' }));
  });

  it('delivers to club addresses, counts unread and notifies the readers', () => {
    const before = shared('kassier')!.unread;
    mockServer.handle(
      'POST',
      `/api/v1/mail/mailboxes/${own('spieler').id}/messages`,
      { to: ['VORSTAND@mein-verein.at'], cc: ['extern@example.com'], subject: 'Frage', body: 'Hallo' },
      'spieler@example.at',
    );
    expect(mail.folder(member('spieler'), own('spieler').id, 'SENT')[0].subject).toBe('Frage');
    expect(shared('kassier')!.unread).toBe(before + 1);
    // Every board member gets the notice, not the sender.
    expect(notifications.list('kassier', false).items[0]).toMatchObject({ kind: 'MAIL', title: 'Neue E-Mail von David Spieler', link: '/mail' });
    expect(notifications.list('spieler', false).items.some((n) => n.kind === 'MAIL' && n.title.includes('David'))).toBe(false);

    const box = shared('kassier')!.id;
    const received = mail.folder(member('kassier'), box, 'INBOX').find((m) => m.subject === 'Frage')!;
    expect(mail.get(member('kassier'), box, received.id).read).toBe(true);
    expect(shared('kassier')!.unread).toBe(before);
  });

  it('moves to the trash first, then deletes for good', () => {
    const box = own('trainer').id;
    const [first] = mail.folder(member('trainer'), box, 'INBOX');
    mail.delete(member('trainer'), box, first.id);
    expect(mail.folder(member('trainer'), box, 'TRASH').map((m) => m.id)).toContain(first.id);
    mail.delete(member('trainer'), box, first.id);
    expect(() => mail.get(member('trainer'), box, first.id)).toThrow(expect.objectContaining({ code: 'mail.not-found' }));
  });

  it('refuses invalid mails like the server', () => {
    const send = (body: Record<string, unknown>) => () => mail.send(member('spieler'), own('spieler').id, body);
    expect(send({ to: [], subject: 'x' })).toThrow(expect.objectContaining({ code: 'mail.recipient-missing' }));
    expect(send({ to: ['jürgen@b.at'], subject: 'x' })).toThrow(expect.objectContaining({ code: 'mail.address-invalid' }));
    expect(send({ to: ['a@b.at'], subject: 'a\nBcc: x@y.at' })).toThrow(expect.objectContaining({ code: 'mail.subject-invalid' }));
  });
});
