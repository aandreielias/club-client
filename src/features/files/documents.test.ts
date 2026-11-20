import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import { p, template } from '../../lib/mock/wordTemplate';
import type { Member } from '../../lib/types';
import { checkTemplate, DOCUMENT_SLOTS } from './documents';
import { documents } from './mock';
import type { SettingSlot } from './model';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('mock documents (server: DocumentHandlers)', () => {
  it('refuses unknown placeholders with their names and lists used outside their block', async () => {
    const bad = await template(JSZip, p(null, '{{Titl}}') + p(null, '{{Nummer}}'));
    await expect(checkTemplate(JSZip, 'INVITATION_TEMPLATE', bad)).rejects.toMatchObject({
      code: 'document.placeholder-unknown',
      details: ['Nummer', 'Titl'],
    });
    await expect(checkTemplate(JSZip, 'NOPE' as SettingSlot, bad)).rejects.toMatchObject({ code: 'document.kind-not-found' });
  });

  it('fills a sample of every kind without leftover placeholders', async () => {
    for (const slot of DOCUMENT_SLOTS) {
      const zip = await JSZip.loadAsync(await documents.sample(member('vorstand'), slot));
      expect([slot, (await zip.file('word/document.xml')!.async('string')).includes('{{')]).toEqual([slot, false]);
    }
    await expect(documents.sample(member('spieler'), 'DOKUMENT')).rejects.toThrow();
  });
});
