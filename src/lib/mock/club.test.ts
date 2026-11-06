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
  it('starts with the SDG brand, validates like the server and resets to the defaults', () => {
    expect(directory.clubInfo().brand).toEqual(SDG_BRAND);

    expect(() => directory.changeBrand(member('spieler'), (b) => b.reset())).toThrow();
    for (const bad of [{ primary: 'red' }, { radiusSmall: 13 }, { headingFont: 'COMIC' }, { appName: 'x'.repeat(31) }, { mailSignOff: 'a\nb' }]) {
      expect(() => directory.changeBrand(member('vorstand'), (b) => b.save({ ...SDG_BRAND, ...bad }))).toThrow();
    }
    const saved = directory.changeBrand(member('vorstand'), (b) =>
      b.save({ ...SDG_BRAND, primary: '#aa0000', mailFooter: 'Zeile 1\nZeile 2', appName: ' ' }),
    );
    expect(saved.brand).toMatchObject({ primary: '#AA0000', mailFooter: 'Zeile 1\nZeile 2', appName: null });

    expect(directory.changeBrand(member('admin'), (b) => b.reset()).brand).toEqual(DEFAULT_BRAND);
    directory.changeBrand(member('admin'), (b) => b.save({ ...SDG_BRAND }));
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

describe('mock brand e-mail', () => {
  it('previews a checked draft for admin/board, escaped like the server', () => {
    const sample = (brand: object, subject: string | null = null, text: string | null = null) => ({ brand, subject, text });
    expect(() => directory.sampleMail(member('spieler'), sample({ ...SDG_BRAND }))).toThrow();
    expect(() => directory.sampleMail(member('vorstand'), sample({ ...SDG_BRAND, primary: 'red' }))).toThrow();
    expect(() => directory.sampleMail(member('vorstand'), sample({ ...SDG_BRAND }, 'a\nb'))).toThrow();
    expect(() => directory.sampleMail(member('vorstand'), sample({ ...SDG_BRAND }, null, 'x'.repeat(2001)))).toThrow();
    const own = directory.sampleMail(member('vorstand'), sample({ ...SDG_BRAND }, 'Probe', 'Zeile <i>'));
    expect(own.subject).toMatch(/^\[.+\] Probe$/);
    expect(own.html).toContain('Zeile &lt;i&gt;');
    const { subject, html } = directory.sampleMail(
      member('vorstand'),
      sample({ ...SDG_BRAND, mailGreeting: 'Servus {vorname}!', mailFooter: 'A <b>\nB' }),
    );
    expect(subject).toMatch(/^\[.+\] Neue Aufgabe/);
    expect(html).toContain(`Servus ${member('vorstand').firstName}!`);
    expect(html).toContain('A &lt;b&gt;<br>B');
    expect(html).toContain('color:#57263C');
  });
});
