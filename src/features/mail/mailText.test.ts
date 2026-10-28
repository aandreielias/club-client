import { describe, expect, it } from 'vitest';
import { mailSegments, mailToken } from './mailText';

const id = '11111111-2222-3333-4444-555555555555';
const folder = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('mail text links', () => {
  it('writes the composer marker with a clean title', () => {
    expect(mailToken({ kind: 'TASK', id, title: 'Bälle [neu]' })).toBe(`[Bälle  neu](club:task/${id})`);
  });

  it('finds written-out links with a website or the club: fallback', () => {
    const body = `Siehe „Damen 1“ (https://verein.at/app/records/team/${id}).\n- Datei: „Plan.pdf“ (club:file/${folder}:${id})`;
    expect(mailSegments(body)).toEqual([
      { text: 'Siehe ' },
      { title: 'Damen 1', kind: 'team', id },
      { text: '.\n- Datei: ' },
      { title: 'Plan.pdf', kind: 'file', id: `${folder}:${id}` },
    ]);
  });

  it('leaves other links and plain text alone', () => {
    expect(mailSegments('„Zitat“ (https://example.com/x)')).toEqual([{ text: '„Zitat“ (https://example.com/x)' }]);
    expect(mailSegments('')).toEqual([]);
  });
});
