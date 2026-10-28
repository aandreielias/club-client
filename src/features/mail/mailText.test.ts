import { describe, expect, it } from 'vitest';
import { mailSegments, refCode, refCodes } from './mailText';

describe('mail record codes', () => {
  it('knows which links of a formatted mail stand for a record', () => {
    expect(refCode('https://verein.at/app/r/K7Q2M9XW4P')).toBe('K7Q2M9XW4P');
    expect(refCode('club:r/K7Q2M9XW4P')).toBe('K7Q2M9XW4P');
    expect(refCode('https://example.com/x')).toBeNull();
  });

  it('finds every code once', () => {
    expect(refCodes('<a href="club:r/AAAAAAAAAA">x</a> https://v.at/app/r/BBBBBBBBBB club:r/AAAAAAAAAA')).toEqual(['AAAAAAAAAA', 'BBBBBBBBBB']);
  });

  it('splits the plain-text copy into text and codes', () => {
    const body = 'Siehe Verweis K7Q2M9XW4P (https://verein.at/app/r/K7Q2M9XW4P).\n- Verweis AAAAAAAAAA (club:r/AAAAAAAAAA)';
    expect(mailSegments(body)).toEqual([{ text: 'Siehe ' }, { code: 'K7Q2M9XW4P' }, { text: '.\n- ' }, { code: 'AAAAAAAAAA' }]);
    expect(mailSegments('„Zitat“ (https://example.com/x)')).toEqual([{ text: '„Zitat“ (https://example.com/x)' }]);
  });
});
