import { FormState } from '../../lib/state/FormState.svelte';
import type { BoardSettings, OfficeKind, OfficeSetting } from './MembersApi';

type Errors = Partial<Record<'label' | 'holders' | 'termYears', string>>;

/** server: BoardRules — limits of one office's setting. */
export const OFFICE_LIMITS = { label: 40, holders: 20, termYears: 10 } as const;

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
  partners = $state<OfficeKind[]>([]);
  readonly office: OfficeKind;

  constructor(settings: BoardSettings, office: OfficeKind) {
    super();
    this.office = office;
    const setting = settings.offices.find((o) => o.office === office);
    if (setting) {
      this.label = setting.label;
      this.enabled = setting.enabled;
      this.minHolders = setting.minHolders;
      this.maxHolders = setting.maxHolders;
      this.termYears = setting.termYears;
    }
    this.partners = partnersOf(settings, office);
  }

  /** The chair always exists: the board needs someone to convene. */
  get fixed(): boolean {
    return this.office === 'CHAIR';
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
    const errors: Errors = {};
    const label = this.label.trim();
    if (!label || label.length > OFFICE_LIMITS.label) errors.label = `1 bis ${OFFICE_LIMITS.label} Zeichen.`;
    const { minHolders: min, maxHolders: max } = this;
    if (!Number.isInteger(min) || min < 0 || min > OFFICE_LIMITS.holders) errors.holders = `Mindestens 0 bis ${OFFICE_LIMITS.holders}.`;
    else if (max != null && (!Number.isInteger(max) || max < 1 || max > OFFICE_LIMITS.holders || max < min)) {
      errors.holders = `Höchstens 1 bis ${OFFICE_LIMITS.holders} und nicht weniger als mindestens, oder leer.`;
    }
    if (!Number.isInteger(this.termYears) || this.termYears < 1 || this.termYears > OFFICE_LIMITS.termYears) {
      errors.termYears = `1 bis ${OFFICE_LIMITS.termYears} Jahre.`;
    }
    return errors;
  }
}
