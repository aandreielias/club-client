import { FormState } from '../../lib/state/FormState.svelte';
import type { Role } from '../../lib/types';
import type { MailboxAdmin, MailboxInput } from './model';

export type MailboxField = 'address' | 'name' | 'owner';
export type MailboxOwner = 'member' | 'shared';

const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** A mailbox being added or changed by admin/board: address, name and who reads it (one member, or everyone with one of the roles, offices or coached teams, plus named members). */
export class MailboxForm extends FormState<Partial<Record<MailboxField, string>>> {
  address = $state('');
  name = $state('');
  owner = $state<MailboxOwner>('member');
  memberId = $state('');
  roles = $state<Role[]>([]);
  offices = $state<string[]>([]);
  teamIds = $state<string[]>([]);
  memberIds = $state<string[]>([]);

  constructor(readonly id: string | null = null) {
    super();
  }

  static edit(mailbox: MailboxAdmin): MailboxForm {
    const form = new MailboxForm(mailbox.id);
    form.address = mailbox.address;
    form.name = mailbox.name;
    form.owner = mailbox.memberId ? 'member' : 'shared';
    form.memberId = mailbox.memberId ?? '';
    form.roles = [...mailbox.owners.roles];
    form.offices = [...mailbox.owners.offices];
    form.teamIds = [...mailbox.owners.teamIds];
    form.memberIds = [...mailbox.owners.memberIds];
    return form;
  }

  toInput(): MailboxInput {
    return {
      address: this.address.trim().toLowerCase(),
      name: this.name.trim(),
      memberId: this.owner === 'member' ? this.memberId || null : null,
      owners: this.owner === 'shared' ? { roles: this.roles, offices: this.offices, teamIds: this.teamIds, memberIds: this.memberIds } : null,
    };
  }

  protected validate(): Partial<Record<MailboxField, string>> {
    const errors: Partial<Record<MailboxField, string>> = {};
    const input = this.toInput();
    if (!ADDRESS.test(input.address)) errors.address = 'Gültige E-Mail-Adresse angeben (keine Umlaute vor dem @).';
    if (!input.name || input.name.length > 100) errors.name = 'Name mit 1 bis 100 Zeichen angeben.';
    const shared = input.owners
      ? input.owners.roles.length + input.owners.offices.length + input.owners.teamIds.length + input.owners.memberIds.length
      : 0;
    if (this.owner === 'member' && !input.memberId) errors.owner = 'Mitglied wählen.';
    if (this.owner === 'shared' && !shared) errors.owner = 'Mindestens eine Rolle, ein Amt, eine Mannschaft oder ein Mitglied wählen.';
    else if (input.owners && [input.owners.roles, input.owners.offices, input.owners.teamIds, input.owners.memberIds].some((l) => l.length > 20))
      errors.owner = 'Höchstens 20 je Liste.';
    return errors;
  }
}
