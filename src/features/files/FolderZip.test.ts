import { describe, expect, it } from 'vitest';
import { FolderZip } from './FolderZip';

describe('FolderZip', () => {
  it('keeps every entry inside the unpacked folder', () => {
    expect(FolderZip.segment('..')).toBe('_');
    expect(FolderZip.segment('a/../../x')).toBe('a_.._.._x');
    expect(FolderZip.segment('..\\evil')).toBe('_evil');
    expect(FolderZip.segment('.hidden')).toBe('hidden');
    expect(FolderZip.segment('Fotos 2026')).toBe('Fotos 2026');
  });

  it('keeps names unique inside the archive', () => {
    const used = new Set<string>();
    expect(FolderZip.uniquePath('Plan.pdf', used)).toBe('Plan.pdf');
    expect(FolderZip.uniquePath('plan.PDF', used)).toBe('plan (2).PDF');
    expect(FolderZip.uniquePath('Sub/Plan.pdf', used)).toBe('Sub/Plan.pdf');
    expect(FolderZip.uniquePath('Notizen', used)).toBe('Notizen');
    expect(FolderZip.uniquePath('Notizen', used)).toBe('Notizen (2)');
  });
});
