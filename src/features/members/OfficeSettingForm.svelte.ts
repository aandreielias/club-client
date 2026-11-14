import { FormState } from '../../lib/state/FormState.svelte';
import { SEEDED_OFFICES, type BoardSettings, type OfficeDuty, type OfficeInput, type OfficeKind, type OfficeSetting } from './MembersApi';
import { settings } from '../../settings';
import type { FinanceLevel } from '../../lib/types';

type Errors = Partial<Record<'label' | 'holders' | 'termYears', string>>;

/** server: BoardRules — limits of one office's setting. */
/** Offices one person may hold together with `office`; a pair counts for both. */
export function partnersOf(settings: BoardSettings, office: OfficeKind): OfficeKind[] {
  return settings.combinations.flatMap((p) => (p.a === office ? [p.b] : p.b === office ? [p.a] : []));
}

/** Editing one office of the board settings (Einstellungen › Funktionen); the rest of the settings is kept as it is. */
export class OfficeSettingForm extends FormState<Errors> {
  label = $state('');
  enabled = $state(true);
  minHolders = $state(1);
  maxHolders = $state<number | null>(1);
  termYears = $state(3);
  board = $state(false);
  duty = $state<OfficeDuty>('NONE');
  finance = $state<FinanceLevel>('NONE');
  partners = $state<OfficeKind[]>([]);
  /** '' for a new office (the server makes the key). */
  readonly office: OfficeKind;

  constructor(settings: BoardSettings | null, office: OfficeKind = '') {
    super();
    this.office = office;
    if (!settings) {
      this.minHolders = 0;
      return;
    }
    const setting = settings.offices.find((o) => o.office === office);
    if (setting) {
      this.label = setting.label;
      this.enabled = setting.enabled;
      this.minHolders = setting.minHolders;
      this.maxHolders = setting.maxHolders;
      this.termYears = setting.termYears;
      this.board = setting.board;
      this.duty = setting.duty ?? 'NONE';
      this.finance = setting.finance ?? 'NONE';
    }
    this.partners = partnersOf(settings, office);
  }

  /** The chair always exists: the board needs someone to convene. */
  get fixed(): boolean {
    return this.office === 'CHAIR';
  }

  /** The seeded offices keep their place on or off the board. */
  get seeded(): boolean {
    return SEEDED_OFFICES.includes(this.office);
  }

  get isNew(): boolean {
    return !this.office;
  }

  toNew(): OfficeInput {
    return {
      label: this.label.trim(),
      board: this.board,
      minHolders: this.minHolders,
      maxHolders: this.maxHolders,
      termYears: this.termYears,
      duty: this.duty,
      finance: this.finance,
    };
  }

  /** The whole settings with this office and its pairs replaced. */
  toSettings(settings: BoardSettings): BoardSettings {
    const setting: OfficeSetting = {
      office: this.office,
      label: this.label.trim(),
      enabled: this.fixed || this.enabled,
      minHolders: this.minHolders,
      maxHolders: this.maxHolders,
      termYears: this.termYears,
      board: this.board,
      duty: this.duty,
      finance: this.finance,
    };
    return {
      ...settings,
      offices: settings.offices.map((o) => (o.office === this.office ? setting : o)),
      combinations: [
        ...settings.combinations.filter((p) => p.a !== this.office && p.b !== this.office),
        ...this.partners.map((b) => ({ a: this.office, b })),
      ],
    };
  }

  protected validate(): Errors {
    const limit = settings.members.office;
    const errors: Errors = {};
    const label = this.label.trim();
    if (!label || label.length > limit.labelMaxLength) errors.label = `Bezeichnung mit 1 bis ${limit.labelMaxLength} Zeichen angeben.`;
    const { minHolders: min, maxHolders: max } = this;
    if (!Number.isInteger(min) || min < 0 || min > limit.maxHolders) errors.holders = `Mindestens 0 bis ${limit.maxHolders}.`;
    else if (max != null && (!Number.isInteger(max) || max < 1 || max > limit.maxHolders || max < min)) {
      errors.holders = `Höchstens 1 bis ${limit.maxHolders} und nicht weniger als mindestens, oder leer.`;
    }
    if (!Number.isInteger(this.termYears) || this.termYears < 1 || this.termYears > limit.maxTermYears) {
      errors.termYears = `1 bis ${limit.maxTermYears} Jahre.`;
    }
    return errors;
  }
}
