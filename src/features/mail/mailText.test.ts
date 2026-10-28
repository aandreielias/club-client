import { describe, expect, it } from 'vitest';
import { mailSegments, recordTarget } from './mailText';

const id = '11111111-2222-3333-4444-555555555555';
const folder = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('mail text links', () => {
  it('knows which links of a formatted mail open a record', () => {
    expect(recordTarget(`https://verein.at/app/records/task/${id}`)).toEqual({ kind: 'task', id });
    expect(recordTarget(`club:file/${folder}:${id}`)).toEqual({ kind: 'file', id: `${folder}:${id}` });
    expect(recordTarget('https://example.com/x')).toBeNull();
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
