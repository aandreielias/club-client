import { FormState } from '../../lib/state/FormState.svelte';
import type { Role } from '../../lib/types';
import type { MailboxAdmin, MailboxInput } from './model';

export type MailboxField = 'address' | 'name' | 'owner';
export type MailboxOwner = 'member' | 'role';

const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** A mailbox being added or changed by admin/board: address, name and who reads it (one member, or a role). */
export class MailboxForm extends FormState<Partial<Record<MailboxField, string>>> {
  address = $state('');
  name = $state('');
  owner = $state<MailboxOwner>('member');
  memberId = $state('');
  role = $state<Role | ''>('');

  constructor(readonly id: string | null = null) {
    super();
  }

  static edit(mailbox: MailboxAdmin): MailboxForm {
    const form = new MailboxForm(mailbox.id);
    form.address = mailbox.address;
    form.name = mailbox.name;
    form.owner = mailbox.memberId ? 'member' : 'role';
    form.memberId = mailbox.memberId ?? '';
    form.role = mailbox.role ?? '';
    return form;
  }

  toInput(): MailboxInput {
    return {
      address: this.address.trim().toLowerCase(),
      name: this.name.trim(),
      memberId: this.owner === 'member' ? this.memberId || null : null,
      role: this.owner === 'role' ? this.role || null : null,
    };
  }

  protected validate(): Partial<Record<MailboxField, string>> {
    const errors: Partial<Record<MailboxField, string>> = {};
    const input = this.toInput();
    if (!ADDRESS.test(input.address)) errors.address = 'Gültige E-Mail-Adresse (ohne Umlaute vor dem @).';
    if (!input.name || input.name.length > 100) errors.name = 'Name mit 1 bis 100 Zeichen.';
    if (!input.memberId && !input.role) errors.owner = this.owner === 'member' ? 'Mitglied wählen.' : 'Rolle wählen.';
    return errors;
  }
}
