import { describe, expect, it } from 'vitest';
import { OfficeReader } from './OfficeReader';

describe('OfficeReader columns', () => {
  it('converts between cell references and column numbers', () => {
    expect(OfficeReader.column('A1')).toBe(0);
    expect(OfficeReader.column('C12')).toBe(2);
    expect(OfficeReader.column('AA3')).toBe(26);
    expect(OfficeReader.columnName(0)).toBe('A');
    expect(OfficeReader.columnName(25)).toBe('Z');
    expect(OfficeReader.columnName(26)).toBe('AA');
    expect(OfficeReader.column('')).toBeNull();
  });
});
