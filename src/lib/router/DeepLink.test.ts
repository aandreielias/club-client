import { describe, expect, it } from 'vitest';
import { deepLink } from './DeepLink';

const resolve = (link: string) =>
  link.startsWith('/tasks/') ? { window: { kind: 'task', id: link.slice(7) } } : link === '/account' ? { path: '/account' } : null;

describe('deepLink', () => {
  it('turns server links into hash routes', () => {
    expect(deepLink('/tasks/t-1', resolve)).toBe('/#/?open=task/t-1');
    expect(deepLink('/account/', resolve)).toBe('/#/account');
    // Unknown to the resolver: a client route of its own (e.g. a mail's record code).
    expect(deepLink('/r/K7Q2M9XW4P', resolve)).toBe('/#/r/K7Q2M9XW4P');
  });

  it('keeps the app below its base path (GitHub Pages)', () => {
    expect(deepLink('/club-client/tasks/t-1', resolve, '/club-client/')).toBe('/club-client/#/?open=task/t-1');
    expect(deepLink('/club-client/', resolve, '/club-client/')).toBeNull();
  });

  it('leaves the app itself alone', () => {
    expect(deepLink('/index.html', resolve)).toBeNull();
    expect(deepLink('/', resolve)).toBeNull();
  });
});
