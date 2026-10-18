import { settings } from '../../settings';
import type { Member, Role } from '../../lib/types';
import type { Invitation, ProfilePatch } from './MembersApi';

export type MemberField = 'email' | 'firstName' | 'lastName' | 'birthDate' | 'phone' | 'roles';
export type MemberFormErrors = Partial<Record<MemberField, string>>;

const limits = settings.members;
/** server: Member.normalizeEmail — ASCII local part (no SMTPUTF8 at most providers), no ß domains */
const EMAIL = /^[\x21-\x3f\x41-\x7e]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9 /-]{6,20}$/;

function nameError(value: string): string | undefined {
  const name = value.trim();
  return !name || name.length > limits.nameMaxLength ? `1 bis ${limits.nameMaxLength} Zeichen.` : undefined;
}

function birthDateError(value: string, today: string): string | undefined {
  if (!value) return undefined;
  if (value >= today) return 'Das Datum liegt nicht in der Vergangenheit.';
  if (value < limits.earliestBirthDate) return 'Das Datum ist zu früh.';
  return undefined;
}

function phoneError(value: string): string | undefined {
  return value.trim() && !PHONE.test(value.trim()) ? 'Ziffern, Leerzeichen, / und -, optional mit + am Anfang.' : undefined;
}

/** Shared state handling of the member forms: errors only after the first submit. */
abstract class MemberFormBase {
  submitted = $state(false);
  readonly errors: MemberFormErrors;
  readonly valid: boolean;

  constructor(protected readonly today: string) {
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  error(field: MemberField): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  protected abstract validate(): MemberFormErrors;
}

/** New account from the membership application: e-mail, name, optional birth date, phone, guardian, roles. */
export class InviteForm extends MemberFormBase {
  email = $state('');
  firstName = $state('');
  lastName = $state('');
  birthDate = $state('');
  phone = $state('');
  photoConsent = $state(false);
  guardianId = $state('');
  roles = $state<Role[]>(['PLAYER']);

  toInvitation(): Invitation {
    return {
      email: this.email.trim().toLowerCase(),
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      birthDate: this.birthDate || null,
      phone: this.phone.trim() || null,
      photoConsent: this.photoConsent,
      guardianId: this.guardianId || null,
      roles: [...this.roles],
    };
  }

  protected validate(): MemberFormErrors {
    const errors: MemberFormErrors = {};
    const email = this.email.trim();
    if (!EMAIL.test(email) || email.includes('ß')) errors.email = 'Gültige E-Mail-Adresse angeben (keine Umlaute vor dem @).';
    const first = nameError(this.firstName);
    if (first) errors.firstName = first;
    const last = nameError(this.lastName);
    if (last) errors.lastName = last;
    const birth = birthDateError(this.birthDate, this.today);
    if (birth) errors.birthDate = birth;
    const phone = phoneError(this.phone);
    if (phone) errors.phone = phone;
    return errors;
  }
}

/** Edits another member's profile; only changed fields are sent. */
export class ProfileForm extends MemberFormBase {
  firstName = $state('');
  lastName = $state('');
  birthDate = $state('');
  phone = $state('');
  photoConsent = $state(false);

  constructor(
    readonly original: Member,
    today: string,
  ) {
    super(today);
    this.firstName = original.firstName;
    this.lastName = original.lastName;
    this.birthDate = original.birthDate ?? '';
    this.phone = original.phone ?? '';
    this.photoConsent = original.photoConsent;
  }

  /** A hidden birth date (null from the server) is never sent back, so it cannot be erased by accident. */
  toPatch(): ProfilePatch {
    const patch: ProfilePatch = {};
    const o = this.original;
    if (this.firstName.trim() !== o.firstName) patch.firstName = this.firstName.trim();
    if (this.lastName.trim() !== o.lastName) patch.lastName = this.lastName.trim();
    if (this.birthDate && this.birthDate !== o.birthDate) patch.birthDate = this.birthDate;
    if ((this.phone.trim() || null) !== o.phone) patch.phone = this.phone.trim() || null;
    if (this.photoConsent !== o.photoConsent) patch.photoConsent = this.photoConsent;
    return patch;
  }

  protected validate(): MemberFormErrors {
    const errors: MemberFormErrors = {};
    const first = nameError(this.firstName);
    if (first) errors.firstName = first;
    const last = nameError(this.lastName);
    if (last) errors.lastName = last;
    const birth = birthDateError(this.birthDate, this.today);
    if (birth) errors.birthDate = birth;
    const phone = phoneError(this.phone);
    if (phone) errors.phone = phone;
    return errors;
  }
}
