import type { Brand } from '../../lib/types';

/** The brand as an editable form: optional texts as '' (server: null = built-in text). */
type Texts = 'appName' | 'mailGreeting' | 'mailSignOff' | 'mailFooter';
export type BrandForm = Omit<Brand, Texts> & Record<Texts, string>;

export const formOf = (brand: Brand): BrandForm => ({
  ...brand,
  appName: brand.appName ?? '',
  mailGreeting: brand.mailGreeting ?? '',
  mailSignOff: brand.mailSignOff ?? '',
  mailFooter: brand.mailFooter ?? '',
});

export const brandOf = (form: BrandForm): Brand => ({
  ...form,
  appName: form.appName.trim() || null,
  mailGreeting: form.mailGreeting.trim() || null,
  mailSignOff: form.mailSignOff.trim() || null,
  mailFooter: form.mailFooter.trim() || null,
});

export const BRAND_COLORS: readonly { key: keyof Brand; label: string; hint: string }[] = [
  { key: 'primary', label: 'Hauptfarbe', hint: 'Knöpfe, Links, Auswahl' },
  { key: 'primaryHover', label: 'Hauptfarbe dunkel', hint: 'Knöpfe unter dem Mauszeiger' },
  { key: 'accent', label: 'Akzentfarbe', hint: 'Nur kleine Markierungen, nie Schrift' },
  { key: 'tint', label: 'Fläche', hint: 'Seitenleiste und ruhige Flächen' },
  { key: 'text', label: 'Schrift', hint: 'Fließtext' },
  { key: 'textMuted', label: 'Schrift dezent', hint: 'Nebentexte und Beschriftungen' },
  { key: 'line', label: 'Linien', hint: 'Rahmen und Trennlinien' },
];

/** The entries of Einstellungen › Erscheinungsbild, each opened in the window `brand`. */
export const BRAND_PARTS: Record<string, string> = { look: 'Farben, Schrift und Ecken', mail: 'E-Mails', logos: 'Logos' };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The draft as a brand the previews can use: while a hex code or corner is half typed, the saved value stays. */
export function validBrand(form: BrandForm, saved: Brand): Brand {
  const color = (key: keyof Brand) => (HEX.test(form[key] as string) ? (form[key] as string) : (saved[key] as string));
  return {
    ...brandOf(form),
    ...Object.fromEntries(BRAND_COLORS.map(({ key }) => [key, color(key)])),
    radiusSmall: Number.isInteger(form.radiusSmall) ? form.radiusSmall : saved.radiusSmall,
    radiusLarge: Number.isInteger(form.radiusLarge) ? form.radiusLarge : saved.radiusLarge,
  };
}
