import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import { mockServer } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { notifications } from '../notifications/mock';
import { refCodes } from './mailText';
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
      { to: ['VORSTAND@mein-verein.at'], cc: ['extern@example.com'], bcc: ['geheim@example.com'], subject: 'Frage', html: '<p>Hallo</p>' },
      'spieler@example.at',
    );
    const [copy] = mail.folder(member('spieler'), own('spieler').id, 'SENT');
    expect(copy.subject).toBe('Frage');
    expect(mail.get(member('spieler'), own('spieler').id, copy.id).bcc).toEqual(['geheim@example.com']);
    expect(shared('kassier')!.unread).toBe(before + 1);
    // Every board member gets the notice, not the sender.
    const notice = notifications.list('kassier', false).items[0];
    expect(notice).toMatchObject({ kind: 'MAIL', title: 'Neue E-Mail von David Spieler' });
    expect(notifications.list('spieler', false).items.some((n) => n.kind === 'MAIL' && n.title.includes('David'))).toBe(false);

    const box = shared('kassier')!.id;
    const received = mail.folder(member('kassier'), box, 'INBOX').find((m) => m.subject === 'Frage')!;
    expect(notice.link).toBe(`/mail/${box}/${received.id}`);
    expect(mail.get(member('kassier'), box, received.id)).toMatchObject({ html: '<p>Hallo</p>', body: 'Hallo', bcc: [] });
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

describe('mock mail links and mailbox admin', () => {
  it('sends linked records only as codes, which the app resolves as the reader sees them', () => {
    const team = directory.teams.data[0];
    const sent = mail.send(member('trainer'), own('trainer').id, {
      to: ['a@b.at'],
      subject: 'Training',
      html: `<p>Mit <a data-ref="team:${team.id}" class="record-ref">x</a> heute</p>`,
      refs: [{ kind: 'TEAM', id: team.id }],
    });
    expect(sent.html + sent.body).not.toContain(team.name);
    expect(sent.html + sent.body).not.toContain(team.id);
    // One record, one code, wherever it is linked.
    const [inline] = refCodes(sent.html!);
    const attached = inline;
    expect(sent.html).toBe(
      `<p>Mit <a href="club:r/${inline}" rel="noopener noreferrer nofollow">Verweis ${inline}</a> heute</p>` +
        `<p>Verknüpft:</p><ul><li><a href="club:r/${attached}" rel="noopener noreferrer nofollow">Verweis ${attached}</a></li></ul>`,
    );
    expect(sent.body).toContain(`Mit Verweis ${inline} (club:r/${inline}) heute`);
    expect(mail.resolveRefs(member('spieler'), [inline, 'ZZZZZZZZZZ'])).toEqual([
      { code: inline, visible: true, kind: 'TEAM', windowId: team.id, title: team.name },
      { code: 'ZZZZZZZZZZ', visible: false, kind: null, windowId: null, title: null },
    ]);
    expect(() => mail.send(member('trainer'), own('trainer').id, { to: ['a@b.at'], subject: 'x', refs: [{ kind: 'TASK', id: 'nope' }] })).toThrow(
      expect.objectContaining({ code: 'mail.ref-unknown' }),
    );
  });

  it('lets admin and board assign mailboxes with step-up', () => {
    const admin = member('admin');
    expect(() => mail.all(member('spieler'))).toThrow(expect.objectContaining({ code: 'access.denied' }));
    directory.confirm(admin);
    const box = mail.save(admin, null, { address: 'Trainer@mein-verein.at', name: 'Trainer', role: 'COACH' });
    expect(box.address).toBe('trainer@mein-verein.at');
    expect(shared('trainer')?.id).toBe(box.id);
    expect(() => mail.save(admin, null, { address: 'trainer@mein-verein.at', name: 'X', role: 'BOARD' })).toThrow(
      expect.objectContaining({ code: 'mail.address-taken' }),
    );
    expect(() => mail.save(admin, null, { address: 'z@mein-verein.at', name: 'X', memberId: 'spieler' })).toThrow(
      expect.objectContaining({ code: 'mail.member-has-mailbox' }),
    );
    mail.remove(admin, box.id);
    expect(shared('trainer')).toBeUndefined();
  });
});

describe('mock mail drafts, signatures and address book', () => {
  it('keeps a draft as typed and drops it once sent', () => {
    const box = own('trainer').id;
    const draft = mail.saveDraft(member('trainer'), box, null, { to: ['halb'], subject: '', html: '<p>Ent<i>wurf</i></p>' });
    expect(draft).toMatchObject({ folder: 'DRAFTS', to: ['halb'], body: 'Entwurf' });
    expect(mail.saveDraft(member('trainer'), box, draft.id, { to: ['a@b.at'], subject: 'Fertig' }).id).toBe(draft.id);
    expect(mail.folder(member('trainer'), box, 'DRAFTS')).toHaveLength(1);
    mail.send(member('trainer'), box, { to: ['a@b.at'], subject: 'Fertig', html: '<p>x</p>', draftId: draft.id });
    expect(mail.folder(member('trainer'), box, 'DRAFTS')).toHaveLength(0);
  });

  it('lets owners sign their mailbox and admin/board the shared one', () => {
    expect(mail.setSignature(member('spieler'), own('spieler').id, '<p><b>David</b><script>x()</script></p>').signature).toBe('<p><b>David</b></p>');
    const board = shared('kassier')!;
    expect(board.signatureEditable).toBe(true);
    expect(() => mail.setSignature(member('trainer'), board.id, '<p>x</p>')).toThrow(expect.objectContaining({ code: 'mail.mailbox-not-found' }));
    expect(mail.addressBook().some((e) => e.address === 'vorstand@mein-verein.at' && e.role === 'BOARD')).toBe(true);
  });
});
