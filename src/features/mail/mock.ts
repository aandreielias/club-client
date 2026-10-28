// Mock of the club-server mail module (MailHandlers + the in-memory mail gateway): every club address is hosted here,
// mail to other addresses only lands in SENT. Personal mailboxes for the seeded members, a shared one for the board.
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { resolveRef } from '../../lib/mock/recordRefs';
import type { LinkedRef, RefKind } from '../../lib/records/refs';
import { ADMIN_BOARD, type Member, type Role } from '../../lib/types';
import { settings } from '../../settings';
import { meetings } from '../meetings/mock';
import type { Mail, Mailbox, MailboxAdmin, MailFolder, MailSummary } from './model';

const fail = MockServer.fail;
const limits = settings.mail;
const DOMAIN = 'mein-verein.at';
const PREVIEW = 140;
// server: mail.domain.Addresses
const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
// server: MailRefs.TOKEN
const TOKEN = /\[([^\]\n]{0,300})\]\(club:([a-z]+)\/([\w-]{1,64})\)/g;
const REF_LABELS: Record<RefKind, string> = {
  TASK: 'Aufgabe',
  APPOINTMENT: 'Termin',
  ITEM: 'Gegenstand',
  FILE: 'Datei',
  MEMBER: 'Mitglied',
  TEAM: 'Team',
  LOCATION: 'Ort',
  TOURNAMENT: 'Turnier',
  MEETING: 'Sitzung',
};

/** server: mail_mailbox */
interface StoredMailbox {
  id: string;
  address: string;
  name: string;
  memberId: string | null;
  role: Role | null;
}

export class MockMail {
  readonly mailboxes: MockTable<StoredMailbox[]>;
  /** address → mails (server: MemoryMailGateway) */
  readonly mails: MockTable<Record<string, Mail[]>>;

  constructor(private readonly people: MockDirectory) {
    this.mailboxes = new MockTable('mailboxes', () => this.seedMailboxes());
    this.mails = new MockTable('mails', () => this.seedMails());
    // server: MailboxRepository.deleteOwnedBy (GDPR erasure)
    mockServer.events.subscribe((event) => {
      if (event.type !== 'members.member-erased') return;
      const memberId = (event.data as { memberId: string }).memberId;
      this.mailboxes.data.splice(0, this.mailboxes.data.length, ...this.mailboxes.data.filter((b) => b.memberId !== memberId));
      this.mailboxes.save();
    });
  }

  list(member: Member): Mailbox[] {
    return this.mailboxes.data
      .filter((b) => this.opens(member, b))
      .sort((a, b) => Number(a.memberId === null) - Number(b.memberId === null) || a.name.localeCompare(b.name, 'de'))
      .map((b) => ({
        id: b.id,
        address: b.address,
        name: b.name,
        kind: b.memberId ? 'PERSONAL' : 'SHARED',
        unread: this.box(b.address).filter((m) => m.folder === 'INBOX' && !m.read).length,
      }));
  }

  folder(member: Member, mailboxId: string, folder: string | null): MailSummary[] {
    const box = this.mailbox(member, mailboxId);
    const wanted = (folder ?? 'INBOX') as MailFolder;
    if (!['INBOX', 'SENT', 'TRASH'].includes(wanted)) fail(400, 'request.invalid');
    return this.box(box.address)
      .filter((m) => m.folder === wanted)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .map((m) => ({ id: m.id, from: m.from, fromName: m.fromName, subject: m.subject, preview: preview(m.body), sentAt: m.sentAt, read: m.read }));
  }

  get(member: Member, mailboxId: string, mailId: string): Mail {
    const mail = this.find(this.mailbox(member, mailboxId), mailId);
    if (!mail.read) {
      mail.read = true;
      this.mails.save();
    }
    return { ...mail };
  }

  send(member: Member, mailboxId: string, body: Record<string, any>): Mail {
    const box = this.mailbox(member, mailboxId);
    const clean = (list: unknown): string[] => [...new Set((Array.isArray(list) ? list : []).map((a) => String(a).trim().toLowerCase()))];
    const to = clean(body.to);
    const cc = clean(body.cc).filter((a) => !to.includes(a));
    if ([...to, ...cc].some((a) => a.length > 254 || !ADDRESS.test(a))) fail(400, 'mail.address-invalid');
    if (!to.length) fail(400, 'mail.recipient-missing');
    if (to.length + cc.length > limits.maxRecipients) fail(400, 'mail.too-many-recipients');
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (!subject || subject.length > limits.subjectMaxLength || /[\r\n]/.test(subject)) fail(400, 'mail.subject-invalid');
    const raw = typeof body.body === 'string' ? body.body.trim() : '';
    if (raw.length > limits.bodyMaxLength) fail(400, 'mail.body-too-long');
    const text = this.withRefs(member, raw, Array.isArray(body.refs) ? body.refs : []);

    const sentAt = new Date().toISOString();
    const copy = (folder: MailFolder, read: boolean): Mail => ({
      id: crypto.randomUUID(),
      folder,
      from: box.address,
      fromName: box.name,
      to,
      cc,
      subject,
      body: text,
      sentAt,
      read,
    });
    const sent = copy('SENT', true);
    this.box(box.address).push(sent);
    for (const address of [...to, ...cc]) this.box(address).push(copy('INBOX', false));
    this.mails.save();
    // server: MailHandlers.send - club recipients are told at once
    for (const receiver of this.mailboxes.data.filter((b) => to.includes(b.address) || cc.includes(b.address))) {
      mockServer.events.publish({
        type: 'mail.mail-received',
        data: { mailboxId: receiver.id, fromName: box.name, subject },
        audience: receiver.memberId ? { members: [receiver.memberId] } : { roles: [receiver.role!] },
      });
    }
    return { ...sent };
  }

  /** To the trash; from the trash it is gone. */
  delete(member: Member, mailboxId: string, mailId: string): void {
    const box = this.mailbox(member, mailboxId);
    const mail = this.find(box, mailId);
    const mails = this.box(box.address);
    if (mail.folder === 'TRASH') mails.splice(mails.indexOf(mail), 1);
    else mail.folder = 'TRASH';
    this.mails.save();
  }

  /** server: MailRefs.render - inline markers and attached records written out with title and link */
  private withRefs(viewer: Member, body: string, attached: { kind: RefKind; id: string }[]): string {
    const inline = [...body.matchAll(TOKEN)].map((m) => ({ kind: m[2].toUpperCase() as RefKind, id: m[3] }));
    const all = [...inline, ...attached];
    const unique = all.filter((r, i) => all.findIndex((o) => o.kind === r.kind && o.id === r.id) === i);
    if (unique.length > limits.maxRefs) fail(400, 'mail.too-many-refs');
    const resolved = unique.map((ref) => {
      if (!(ref.kind in REF_LABELS)) fail(400, 'mail.ref-unknown');
      return resolveRef(viewer, ref, 'mail', (id) => {
        try {
          return meetings.get(viewer, id).title;
        } catch {
          return null;
        }
      });
    });
    const website = this.people.clubInfo().website?.trim().replace(/\/+$/, '');
    const written = (kind: RefKind, id: string) => {
      const ref = resolved.find((r) => r.kind === kind && (r.id === id || `${r.parentId}:${r.id}` === id))!;
      return MockMail.written(ref, website ? `${website}/app/records/` : null);
    };
    let text = body.replace(TOKEN, (_, _title, kind: string, id: string) => written(kind.toUpperCase() as RefKind, id));
    const listed = attached.filter((r, i) => attached.findIndex((o) => o.kind === r.kind && o.id === r.id) === i);
    if (listed.length) text += `${text ? '\n\n' : ''}Verknüpft:${listed.map((r) => `\n- ${REF_LABELS[r.kind]}: ${written(r.kind, r.id)}`).join('')}`;
    return text;
  }

  private static written(ref: LinkedRef, base: string | null): string {
    const title = ref.title.replace(/[„“()\n\r]/g, ' ').trim();
    const path = `${ref.kind.toLowerCase()}/${ref.kind === 'FILE' ? `${ref.parentId}:${ref.id}` : ref.id}`;
    return `„${title}“ (${base ? base + path : `club:${path}`})`;
  }

  // --- managing the mailboxes (server: MailHandlers admin part) ---

  all(viewer: Member): MailboxAdmin[] {
    this.people.requireRole(viewer, ADMIN_BOARD);
    return [...this.mailboxes.data]
      .sort((a, b) => Number(a.memberId === null) - Number(b.memberId === null) || a.name.localeCompare(b.name, 'de'))
      .map((b) => this.adminDto(b));
  }

  save(viewer: Member, id: string | null, body: Record<string, any>): MailboxAdmin {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const address = typeof body.address === 'string' ? body.address.trim().toLowerCase() : '';
    if (address.length > 254 || !ADDRESS.test(address)) fail(400, 'mail.address-invalid');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) fail(400, 'mail.mailbox-name-invalid');
    const memberId: string | null = body.memberId || null;
    const role: Role | null = body.role || null;
    if ((memberId === null) === (role === null) || role === 'GUEST') fail(400, 'mail.mailbox-owner-invalid');
    const current = id ? (this.mailboxes.data.find((b) => b.id === id) ?? fail(404, 'mail.mailbox-not-found')) : null;
    if (memberId && !this.people.activeIds().includes(memberId)) fail(400, 'mail.member-unknown');
    if (this.mailboxes.data.some((b) => b !== current && b.address === address)) fail(409, 'mail.address-taken');
    if (memberId && this.mailboxes.data.some((b) => b !== current && b.memberId === memberId)) fail(409, 'mail.member-has-mailbox');
    const saved: StoredMailbox = { id: current?.id ?? crypto.randomUUID(), address, name, memberId, role };
    if (current) Object.assign(current, saved);
    else this.mailboxes.data.push(saved);
    this.mailboxes.save();
    return this.adminDto(saved);
  }

  remove(viewer: Member, id: string): void {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const index = this.mailboxes.data.findIndex((b) => b.id === id);
    if (index < 0) fail(404, 'mail.mailbox-not-found');
    this.mailboxes.data.splice(index, 1);
    this.mailboxes.save();
  }

  private adminDto(b: StoredMailbox): MailboxAdmin {
    return { ...b, memberName: b.memberId ? this.people.displayName(b.memberId) : null };
  }

  private opens(member: Member, box: StoredMailbox): boolean {
    return box.memberId ? box.memberId === member.id : this.people.hasRole(member, [box.role!]);
  }

  /** server: MailHandlers.mailbox - unknown and foreign mailboxes answer 404 alike */
  private mailbox(member: Member, id: string): StoredMailbox {
    const box = this.mailboxes.data.find((b) => b.id === id);
    return box && this.opens(member, box) ? box : fail(404, 'mail.mailbox-not-found');
  }

  private find(box: StoredMailbox, mailId: string): Mail {
    return this.box(box.address).find((m) => m.id === mailId) ?? fail(404, 'mail.not-found');
  }

  private box(address: string): Mail[] {
    return (this.mails.data[address] ??= []);
  }

  private seedMailboxes(): StoredMailbox[] {
    const personal = this.people.members.data
      .filter((m) => m.active && !m.roles.every((r) => r === 'GUEST'))
      .map((m) => ({
        id: `mb-${m.id}`,
        address: `${ascii(m.firstName)}.${ascii(m.lastName)}@${DOMAIN}`,
        name: `${m.firstName} ${m.lastName}`,
        memberId: m.id,
        role: null,
      }));
    return [...personal, { id: 'mb-shared-board', address: `vorstand@${DOMAIN}`, name: 'Vorstand', memberId: null, role: 'BOARD' }];
  }

  private seedMails(): Record<string, Mail[]> {
    const day = 86_400_000;
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();
    const mail = (to: string, from: string, fromName: string, subject: string, body: string, daysAgo: number, read: boolean): Mail => ({
      id: crypto.randomUUID(),
      folder: 'INBOX',
      from,
      fromName,
      to: [to],
      cc: [],
      subject,
      body,
      sentAt: at(daysAgo),
      read,
    });
    const result: Record<string, Mail[]> = {};
    for (const box of this.mailboxes.data) {
      result[box.address] = [
        mail(
          box.address,
          `vorstand@${DOMAIN}`,
          'Vorstand',
          'Willkommen im Vereins-Postfach',
          `Hallo,\n\nab jetzt hast du eine eigene Adresse: ${box.address}.\nE-Mails an diese Adresse landen hier im Posteingang.\n\nSportliche Grüße\nDer Vorstand`,
          3,
          true,
        ),
      ];
    }
    result[`vorstand@${DOMAIN}`] = [
      mail(
        `vorstand@${DOMAIN}`,
        'hallen@stadt-wien.example',
        'Sportamt Wien',
        'Hallenzeiten Wintersaison',
        'Sehr geehrte Damen und Herren,\n\nanbei die Hallenzeiten für die Wintersaison. Bitte bis Monatsende bestätigen.\n\nMit freundlichen Grüßen\nSportamt',
        1,
        false,
      ),
      mail(
        `vorstand@${DOMAIN}`,
        'info@ballsport-shop.example',
        'Ballsport Shop',
        'Angebot Trainingsbälle',
        'Guten Tag,\n\ngerne bieten wir Ihnen 20 Trainingsbälle zum Vereinspreis an.\n\nBeste Grüße',
        5,
        true,
      ),
    ];
    return result;
  }
}

/** "Jürgen Groß" → "juergen.gross"-style local parts (ASCII only, like the server's addresses). */
function ascii(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');
}

function preview(body: string): string {
  const line = body.replace(/\s+/g, ' ').trim();
  return line.length <= PREVIEW ? line : `${line.slice(0, PREVIEW - 1)}…`;
}

export const mail = new MockMail(directory);

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/mail/mailboxes', (req) => ({ items: mail.list(actor(req)) }))
  .on('GET', '/api/v1/mail/mailboxes/:id/messages', (req) => ({ items: mail.folder(actor(req), req.params.id, req.query.get('folder')) }))
  .on('POST', '/api/v1/mail/mailboxes/:id/messages', (req) => mail.send(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/mail/mailboxes/:id/messages/:mailId', (req) => mail.get(actor(req), req.params.id, req.params.mailId))
  .on('DELETE', '/api/v1/mail/mailboxes/:id/messages/:mailId', (req) => mail.delete(actor(req), req.params.id, req.params.mailId))
  .on('GET', '/api/v1/mail/admin/mailboxes', (req) => ({ items: mail.all(actor(req)) }))
  .on('POST', '/api/v1/mail/admin/mailboxes', (req) => mail.save(actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/mail/admin/mailboxes/:id', (req) => mail.save(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/mail/admin/mailboxes/:id', (req) => mail.remove(actor(req), req.params.id));
