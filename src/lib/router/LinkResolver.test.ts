import { describe, expect, it } from 'vitest';
import { LinkResolver } from './LinkResolver';

describe('LinkResolver', () => {
  const links = new LinkResolver()
    .register([{ server: '/appointments/:id', to: ({ id }) => ({ window: { kind: 'appointment', id } }) }])
    .register([{ server: '/me/security', to: () => ({ path: '/account' }) }]);

  it('maps server links to windows or pages', () => {
    expect(links.resolve('/appointments/a1')).toEqual({ window: { kind: 'appointment', id: 'a1' } });
    expect(links.resolve('/me/security?x=1')).toEqual({ path: '/account' });
  });

  it('returns null for unknown or missing links', () => {
    expect(links.resolve('/files/1')).toBeNull();
    expect(links.resolve(null)).toBeNull();
  });
});
