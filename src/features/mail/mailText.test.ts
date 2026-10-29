import { describe, expect, it } from 'vitest';
import { draftForEditor, mailSegments, refCode, refCodes } from './mailText';
import type { MailRef } from './model';

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

describe('draftForEditor', () => {
  const link = (code: string) => `<a href="club:r/${code}" rel="noopener noreferrer nofollow">Verweis ${code}</a>`;
  const refs = new Map<string, MailRef>([
    ['AAAAAAAAAA', { code: 'AAAAAAAAAA', visible: true, kind: 'TEAM', windowId: 't1', title: 'Damen <1>' }],
    ['BBBBBBBBBB', { code: 'BBBBBBBBBB', visible: true, kind: 'FILE', windowId: 'f9:file-1', title: 'Plan.pdf' }],
    ['CCCCCCCCCC', { code: 'CCCCCCCCCC', visible: false, kind: null, windowId: null, title: null }],
  ]);

  it('turns codes back into chips and the attached block into attachments', () => {
    const html = `<p>Mit ${link('AAAAAAAAAA')} und ${link('CCCCCCCCCC')}</p><p>Verknüpft:</p><ul><li>${link('BBBBBBBBBB')}</li></ul>`;
    expect(draftForEditor(html, refs)).toEqual({
      html: '<p>Mit <a data-ref="team:t1">Damen &lt;1></a> und Verweis CCCCCCCCCC</p>',
      attached: [{ kind: 'FILE', id: 'file-1', title: 'Plan.pdf' }],
    });
  });
});
