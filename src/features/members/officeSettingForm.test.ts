import { describe, expect, it } from 'vitest';
import type { BoardSettings, OfficeKind } from './MembersApi';
import { OfficeSettingForm, partnersOf } from './OfficeSettingForm.svelte';

const office = (o: OfficeKind, label: string) => ({ office: o, label, enabled: true, minHolders: 1, maxHolders: 1, termYears: 3, board: true });
const settings = (): BoardSettings => ({
  offices: [office('CHAIR', 'Obfrau'), office('VICE_CHAIR', 'Stellvertretung'), office('TREASURER', 'Kassa'), office('SECRETARY', 'Schrift')],
  minBoardSize: 3,
  oddBoardSize: true,
  cooptWeeks: 4,
  termWarningDays: 60,
  byElectionDays: 30,
  combinations: [
    { a: 'VICE_CHAIR', b: 'TREASURER' },
    { a: 'SECRETARY', b: 'VICE_CHAIR' },
  ],
  multipleKinds: false,
  guardianUntilAge: 18,
  ownConsentAge: 14,
});

describe('OfficeSettingForm', () => {
  it('reads the partners from pairs in either direction', () => {
    expect(partnersOf(settings(), 'VICE_CHAIR')).toEqual(['TREASURER', 'SECRETARY']);
    expect(new OfficeSettingForm(settings(), 'TREASURER').partners).toEqual(['VICE_CHAIR']);
  });

  it('replaces only its own office and pairs', () => {
    const form = new OfficeSettingForm(settings(), 'VICE_CHAIR');
    form.label = ' Vize ';
    form.partners = ['TREASURER'];
    const next = form.toSettings(settings());
    expect(next.offices.map((o) => o.label)).toEqual(['Obfrau', 'Vize', 'Kassa', 'Schrift']);
    expect(next.combinations).toEqual([{ a: 'VICE_CHAIR', b: 'TREASURER' }]);
    expect(next.minBoardSize).toBe(3);
  });

  it('keeps the chair in use', () => {
    const form = new OfficeSettingForm(settings(), 'CHAIR');
    form.enabled = false;
    expect(form.toSettings(settings()).offices[0].enabled).toBe(true);
  });

  it('checks holders and term', () => {
    const form = new OfficeSettingForm(settings(), 'TREASURER');
    form.minHolders = 2;
    expect(form.errors.holders).toBeDefined();
    form.maxHolders = null;
    expect(form.valid).toBe(true);
    form.termYears = 11;
    expect(form.errors.termYears).toBeDefined();
  });
});
