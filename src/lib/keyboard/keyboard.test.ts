import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from './CommandRegistry.svelte';
import { KeyboardService, type KeyEventLike } from './KeyboardService.svelte';
import { Keymap } from './Keymap.svelte';
import { KeySpec } from './KeySpec';

function key(key: string, extra: Partial<KeyEventLike> = {}): KeyEventLike {
  const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : '';
  return { key, code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null, preventDefault: vi.fn(), ...extra };
}

describe('KeySpec', () => {
  it('normalizes specs regardless of spelling', () => {
    expect(KeySpec.normalize('mod+k')).toBe('Mod+K');
    expect(KeySpec.normalize('shift+ctrl+x')).toBe('Ctrl+Shift+X');
    expect(KeySpec.normalize(' g   k ')).toBe('G K');
    expect(KeySpec.normalize('Esc')).toBe('Escape');
    expect(KeySpec.normalize('Mod+,')).toBe('Mod+,');
    expect(KeySpec.normalize('Shift+NoSuchKey')).toBe('');
  });

  it('reads events layout-friendly', () => {
    expect(KeySpec.fromEvent(key('k', { ctrlKey: true }), false)).toBe('Mod+K');
    expect(KeySpec.fromEvent(key('k', { metaKey: true }), true)).toBe('Mod+K');
    expect(KeySpec.fromEvent(key('?', { shiftKey: true }), false)).toBe('?'); // Shift is part of "?"
    expect(KeySpec.fromEvent(key('L', { shiftKey: true }), false)).toBe('Shift+L');
    expect(KeySpec.fromEvent(key('Shift', { shiftKey: true }), false)).toBeNull();
    expect(KeySpec.fromEvent(key('ArrowLeft', { altKey: true }), false)).toBe('Alt+ArrowLeft');
  });

  it('detects clashes including sequence prefixes', () => {
    expect(KeySpec.clashes('g k', 'G K')).toBe(true);
    expect(KeySpec.clashes('g', 'g k')).toBe(true);
    expect(KeySpec.clashes('g k', 'g a')).toBe(false);
    expect(KeySpec.clashes('', 'g')).toBe(false);
  });

  it('labels keys for people', () => {
    expect(KeySpec.text('Mod+K', false)).toBe('Strg + K');
    expect(KeySpec.text('Mod+K', true)).toBe('Cmd + K');
    expect(KeySpec.text('g k', false)).toBe('G, dann K');
    expect(KeySpec.text('ArrowLeft', false)).toBe('Pfeil links');
  });
});

describe('Keymap', () => {
  it('overrides, clears and resets bindings', () => {
    const keymap = new Keymap(null);
    expect(keymap.keys('palette.open')).toBe('Mod+K');
    keymap.set('palette.open', 'mod+p');
    expect(keymap.keys('palette.open')).toBe('Mod+P');
    expect(keymap.isCustom('palette.open')).toBe(true);
    keymap.set('palette.open', 'Mod+K'); // back to the default: no override left
    expect(keymap.isCustom('palette.open')).toBe(false);
    keymap.clear('nav.home');
    expect(keymap.keys('nav.home')).toBe('');
    keymap.resetAll();
    expect(keymap.keys('nav.home')).toBe('G H');
  });

  it('reports clashes only where both commands can be active', () => {
    const keymap = new Keymap(null);
    expect(keymap.conflicts('member.edit', 'e')).toEqual([]); // task.edit and appointment.edit live in other contexts
    expect(keymap.conflicts('nav.files', 'g k')).toEqual(['nav.calendar']);
    expect(keymap.conflicts('page.new', 'g')).toEqual(expect.arrayContaining(['nav.home', 'nav.calendar']));
    expect(keymap.conflicts('task.edit', 'Mod+K')).toEqual(['palette.open']);
  });

  it('has no clashing defaults', () => {
    const keymap = new Keymap(null);
    const ids = ['palette.open', 'sidebar.toggle', 'settings.open', 'help.shortcuts', 'theme.toggle', 'nav.home', 'nav.calendar', 'nav.tasks', 'nav.files', 'nav.teams',
      'nav.notifications', 'nav.members', 'nav.account', 'nav.settings', 'nav.back', 'view.back', 'form.submit', 'window.close', 'window.center', 'window.side', 'window.bottom',
      'window.page', 'page.new', 'list.search', 'list.next', 'list.previous', 'list.open', 'list.reset', 'calendar.previous', 'calendar.next',
      'calendar.today', 'calendar.month', 'calendar.week', 'calendar.list', 'task.edit', 'task.done', 'appointment.edit', 'appointment.yes',
      'appointment.maybe', 'appointment.no', 'member.edit', 'notifications.readAll'] as const;
    for (const id of ids) expect(keymap.conflicts(id, keymap.keys(id)), id).toEqual([]);
  });
});

describe('KeyboardService', () => {
  function setup() {
    const registry = new CommandRegistry();
    const keymap = new Keymap(null);
    const service = new KeyboardService(registry, keymap, 1000, false);
    return { registry, keymap, service };
  }

  it('runs single combos and two-step sequences', () => {
    const { registry, service } = setup();
    const palette = vi.fn();
    const calendar = vi.fn();
    registry.register({ 'palette.open': { run: palette }, 'nav.calendar': { run: calendar } });
    expect(service.handle(key('k', { ctrlKey: true }))).toBe(true);
    expect(palette).toHaveBeenCalledOnce();
    expect(service.handle(key('g'))).toBe(true);
    expect(service.pending).toEqual(['G']);
    expect(service.nextSteps().map((s) => s.id)).toEqual(['nav.calendar']);
    service.handle(key('k'));
    expect(calendar).toHaveBeenCalledOnce();
    expect(service.pending).toEqual([]);
  });

  it('stays out of the way while typing, except for modifier combos and Escape', () => {
    const { registry, service } = setup();
    const next = vi.fn();
    const close = vi.fn();
    const palette = vi.fn();
    registry.register({ 'list.next': { run: next }, 'view.back': { run: close }, 'palette.open': { run: palette } });
    const input = { tagName: 'INPUT', type: 'text', isContentEditable: false, closest: () => null };
    expect(service.handle(key('j', { target: input as unknown as EventTarget }))).toBe(false);
    expect(next).not.toHaveBeenCalled();
    service.handle(key('Escape', { target: input as unknown as EventTarget }));
    service.handle(key('k', { ctrlKey: true, target: input as unknown as EventTarget }));
    expect(close).toHaveBeenCalledOnce();
    expect(palette).toHaveBeenCalledOnce();
  });

  it('ignores keys inside native modal dialogs and while disabled', () => {
    const { registry, service } = setup();
    const next = vi.fn();
    registry.register({ 'list.next': { run: next } });
    const inDialog = { tagName: 'DIV', closest: (s: string) => (s === 'dialog[open]' ? {} : null) };
    expect(service.handle(key('j', { target: inDialog as unknown as EventTarget }))).toBe(false);
    service.enabled = false;
    expect(service.handle(key('j'))).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the newest active handler and falls back when it is inactive', () => {
    const { registry, service } = setup();
    const page = vi.fn();
    const window = vi.fn();
    registry.register({ 'list.next': { run: page } });
    const remove = registry.register({ 'list.next': { run: window } });
    service.handle(key('j'));
    expect(window).toHaveBeenCalledOnce();
    remove();
    registry.register({ 'list.next': { run: window, when: () => false } });
    service.handle(key('j'));
    expect(page).toHaveBeenCalledOnce();
  });

  it('follows custom bindings and drops a broken sequence', () => {
    const { registry, keymap, service } = setup();
    const files = vi.fn();
    const home = vi.fn();
    registry.register({ 'nav.files': { run: files }, 'nav.home': { run: home } });
    keymap.set('nav.files', 'Alt+D');
    service.handle(key('d', { altKey: true }));
    expect(files).toHaveBeenCalledOnce();
    service.handle(key('g'));
    service.handle(key('z')); // no "G Z": the sequence ends, "Z" alone does nothing
    expect(service.pending).toEqual([]);
    service.handle(key('g'));
    service.handle(key('h'));
    expect(home).toHaveBeenCalledOnce();
  });
});
