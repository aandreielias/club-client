import { describe, expect, it } from 'vitest';
import { FolderZip } from './FolderZip';

describe('FolderZip', () => {
  it('keeps names unique inside the archive', () => {
    const used = new Set<string>();
    expect(FolderZip.uniquePath('Plan.pdf', used)).toBe('Plan.pdf');
    expect(FolderZip.uniquePath('plan.PDF', used)).toBe('plan (2).PDF');
    expect(FolderZip.uniquePath('Sub/Plan.pdf', used)).toBe('Sub/Plan.pdf');
    expect(FolderZip.uniquePath('Notizen', used)).toBe('Notizen');
    expect(FolderZip.uniquePath('Notizen', used)).toBe('Notizen (2)');
  });
});
