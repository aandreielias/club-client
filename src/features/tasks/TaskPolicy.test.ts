import { describe, expect, it, vi } from 'vitest';
import { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { ApiClient } from '../../lib/http/ApiClient';
import { ClubPermissions } from '../../lib/policy/ClubPermissions';
import { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { Task } from './model';
import { TaskPolicy } from './TaskPolicy';

const task = (assignees: string[]): Task => ({
  id: 't', teamId: null, appointmentId: null, title: 't', description: null, status: 'OPEN', dueAt: null, createdBy: 'coach', assignees,
  checklist: [], comments: [], createdAt: '2026-01-01T00:00:00Z', completedAt: null, repeatWeeks: null, source: null,
});

describe('TaskPolicy', () => {
  it("counts the tasks of the member's minors as own", () => {
    const api = new ApiClient({ send: vi.fn(), upload: vi.fn(), url: (p) => p }, async () => false);
    const session = new SessionStore(api);
    session.me = {
      member: { id: 'parent', email: 'p@x.at', firstName: 'P', lastName: 'P', birthDate: null, phone: null, photoConsent: true, active: true, roles: ['PARENT'] },
      teams: [],
      missing: [],
      wardIds: ['kid'],
      wardNames: { kid: 'Kind' },
    };
    const policy = new TaskPolicy(session, new ClubPermissions(session, new TeamDirectory(api, session)));
    expect(policy.isAssigned(task(['kid']))).toBe(true);
    expect(policy.canWork(task(['kid']))).toBe(true);
    expect(policy.isAssigned(task(['someone']))).toBe(false);
  });
});
