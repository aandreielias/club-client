import { describe, expect, it } from 'vitest';
import { directory } from './core';
import { DEFAULT_BRAND, SDG_BRAND, isSafeSvg } from './MockBrand';
import type { Member } from '../types';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('mock club facts', () => {
  it('are set up once by an admin, then edited by the board; blank values fall back to club.yml', () => {
    expect(directory.clubInfo()).toMatchObject({ name: 'Mein Verein', configured: false });
    expect(() => directory.updateClub(member('vorstand'), { name: 'X' })).toThrow(); // the first setup is the admin's
    expect(directory.updateClub(member('admin'), { name: 'VC Beispiel' })).toMatchObject({ name: 'VC Beispiel', configured: true });

    expect(() => directory.updateClub(member('spieler'), { name: 'X' })).toThrow();
    expect(() => directory.updateClub(member('vorstand'), { seasonStartMonth: 13 })).toThrow();
    expect(directory.updateClub(member('vorstand'), { name: 'VC Beispiel', registerNumber: '123', seasonStartMonth: 8 })).toMatchObject({
      name: 'VC Beispiel',
      shortName: 'Verein',
      registerNumber: '123',
      seasonStartMonth: 8,
    });
    expect(directory.updateClub(member('vorstand'), { name: ' ' })).toMatchObject({ name: 'Mein Verein', registerNumber: null, seasonStartMonth: 7 });
  });
});

describe('mock club brand', () => {
  it('starts with the SDG brand and logos, validates like the server and resets to the defaults', async () => {
    expect(directory.clubInfo().brand).toEqual(SDG_BRAND);
    expect(directory.clubInfo().assets.logo).toBeTruthy();

    await expect(directory.changeBrand(member('spieler'), (b) => b.reset())).rejects.toThrow();
    for (const bad of [{ primary: 'red' }, { radiusSmall: 13 }, { headingFont: 'COMIC' }, { appName: 'x'.repeat(31) }, { mailSignOff: 'a\nb' }]) {
      await expect(directory.changeBrand(member('vorstand'), (b) => b.save({ ...SDG_BRAND, ...bad }))).rejects.toThrow();
    }
    const saved = await directory.changeBrand(member('vorstand'), (b) =>
      b.save({ ...SDG_BRAND, primary: '#aa0000', mailFooter: 'Zeile 1\nZeile 2', appName: ' ' }),
    );
    expect(saved.brand).toMatchObject({ primary: '#AA0000', mailFooter: 'Zeile 1\nZeile 2', appName: null });

    expect((await directory.changeBrand(member('admin'), (b) => b.reset())).brand).toEqual(DEFAULT_BRAND);
    await directory.changeBrand(member('admin'), (b) => b.save({ ...SDG_BRAND }));
  });

  it('takes PNG and plain SVG images only', async () => {
    const vorstand = member('vorstand');
    const upload = (kind: string, content: BlobPart) => directory.changeBrand(vorstand, (b) => b.saveAsset(kind, new Blob([content])));
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

    expect((await upload('favicon', png)).assets.favicon).toMatch(/^data:image\/png;base64,/);
    expect((await upload('logo', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')).assets.logo).toMatch(/^data:image\/svg\+xml;/);
    await expect(upload('logo', '<svg onload="alert(1)"></svg>')).rejects.toThrow();
    await expect(upload('logo', 'GIF89a')).rejects.toThrow();
    await expect(upload('logo', new Uint8Array(512 * 1024 + 1))).rejects.toThrow();
    await expect(upload('banner', png)).rejects.toThrow();
    expect((await directory.changeBrand(vorstand, (b) => b.deleteAsset('favicon'))).assets.favicon).toBeNull();
  });
});

describe('isSafeSvg (server: SvgCheck)', () => {
  it.each([
    ['<svg><circle r="1"/></svg>', true],
    ['<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"><use href="#a"/><path fill="url(#g)"/></svg>', true],
    ['<html><svg/></html>', false],
    ['<!DOCTYPE svg [<!ENTITY x "y">]><svg/>', false],
    ['<svg><script>alert(1)</script></svg>', false],
    ['<svg><foreignObject/></svg>', false],
    ['<svg><animate attributeName="href"/></svg>', false],
    ['<svg><a href="https://evil.example">x</a></svg>', false],
    ['<svg><image xlink:href="data:image/png;base64,AA"/></svg>', false],
    ['<svg><style>@import url(https://x)</style></svg>', false],
    ['<svg><rect onclick="x()"/></svg>', false],
  ])('%s → %s', (svg, safe) => expect(isSafeSvg(svg)).toBe(safe));
});
