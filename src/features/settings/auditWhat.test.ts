import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../lib/types';
import { auditWhat } from './AuditListModel.svelte';

const entry = (route: string, params: Record<string, string> = {}) => ({ route, params }) as AuditEntry;

describe('auditWhat', () => {
  it('names members, translates words and shortens other ids', () => {
    const names = (id: string) => (id === 'm-1' ? 'Anna Muster' : null);
    expect(auditWhat(entry('/api/v1/members/{id}/roles', { id: 'm-1' }), names)).toBe('Anna Muster › Rollen');
    expect(auditWhat(entry('/api/v1/members'), names)).toBe('Liste');
    expect(auditWhat(entry('/api/v1/tasks/{id}', { id: '0123456789abcdef' }), names)).toBe('01234567');
    expect(auditWhat(entry('/api/v1/members/{id}/guardians/{guardianId}', { id: 'x', guardianId: 'm-1' }), names)).toBe(
      'x › Erziehungsberechtigte › Anna Muster',
    );
  });
});
