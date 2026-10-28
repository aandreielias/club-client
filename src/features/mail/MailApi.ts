import type { ApiClient } from '../../lib/http/ApiClient';
import type { AddressEntry, DraftInput, Mail, MailRef, Mailbox, MailboxAdmin, MailboxInput, MailFolder, MailSummary, OutgoingMail } from './model';

/** Typed access to the mail endpoints of club-server. */
export class MailApi {
  static readonly BASE = '/api/v1/mail/mailboxes';
  static readonly ADMIN = '/api/v1/mail/admin/mailboxes';

  constructor(private readonly api: ApiClient) {}

  /** The member's own mailbox first, then the shared ones of their roles. */
  async mailboxes(): Promise<Mailbox[]> {
    return (await this.api.get<{ items: Mailbox[] }>(MailApi.BASE)).items;
  }

  /** Newest first. */
  async list(mailboxId: string, folder: MailFolder): Promise<MailSummary[]> {
    return (await this.api.get<{ items: MailSummary[] }>(`${this.messages(mailboxId)}?folder=${folder}`)).items;
  }

  /** Marks the mail read. */
  get(mailboxId: string, mailId: string): Promise<Mail> {
    return this.api.get<Mail>(`${this.messages(mailboxId)}/${encodeURIComponent(mailId)}`);
  }

  send(mailboxId: string, mail: OutgoingMail): Promise<Mail> {
    return this.api.post<Mail>(this.messages(mailboxId), mail);
  }

  /** Creates (`draftId` null) or replaces a draft. */
  saveDraft(mailboxId: string, draftId: string | null, draft: DraftInput): Promise<Mail> {
    const path = `${MailApi.BASE}/${encodeURIComponent(mailboxId)}/drafts`;
    return draftId ? this.api.put<Mail>(`${path}/${encodeURIComponent(draftId)}`, draft) : this.api.post<Mail>(path, draft);
  }

  /** Own mailbox; shared ones admin and board. Empty removes it. */
  setSignature(mailboxId: string, html: string): Promise<Mailbox> {
    return this.api.put<Mailbox>(`${MailApi.BASE}/${encodeURIComponent(mailboxId)}/signature`, { html });
  }

  /** What the record codes in a mail stand for, as the viewer sees them. */
  async resolveRefs(codes: readonly string[]): Promise<MailRef[]> {
    if (!codes.length) return [];
    const query = codes.map((c) => `code=${encodeURIComponent(c)}`).join('&');
    return (await this.api.get<{ items: MailRef[] }>(`/api/v1/mail/refs?${query}`)).items;
  }

  /** Every club address with its name. */
  async addressBook(): Promise<AddressEntry[]> {
    return (await this.api.get<{ items: AddressEntry[] }>('/api/v1/mail/address-book')).items;
  }

  /** To the trash; a mail already there, or a draft, is removed. */
  delete(mailboxId: string, mailId: string): Promise<void> {
    return this.api.delete(`${this.messages(mailboxId)}/${encodeURIComponent(mailId)}`);
  }

  /** Admin and board: every mailbox and who reads it. */
  async allMailboxes(): Promise<MailboxAdmin[]> {
    return (await this.api.get<{ items: MailboxAdmin[] }>(MailApi.ADMIN)).items;
  }

  /** Admin and board with step-up; without `id` a new mailbox. */
  saveMailbox(id: string | null, input: MailboxInput): Promise<MailboxAdmin> {
    return id ? this.api.put<MailboxAdmin>(`${MailApi.ADMIN}/${encodeURIComponent(id)}`, input) : this.api.post<MailboxAdmin>(MailApi.ADMIN, input);
  }

  /** The mails stay with the provider. */
  deleteMailbox(id: string): Promise<void> {
    return this.api.delete(`${MailApi.ADMIN}/${encodeURIComponent(id)}`);
  }

  private messages(mailboxId: string): string {
    return `${MailApi.BASE}/${encodeURIComponent(mailboxId)}/messages`;
  }
}
