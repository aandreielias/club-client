import type { ApiClient } from '../../lib/http/ApiClient';
import type { Mail, Mailbox, MailboxAdmin, MailboxInput, MailFolder, MailSummary, OutgoingMail } from './model';

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

  /** To the trash; a mail already there is removed. */
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
