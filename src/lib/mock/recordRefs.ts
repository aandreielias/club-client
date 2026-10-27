// Mock of platform.RecordRefs: a linked record as the actor sees it, with its title.
import { calendar } from '../../features/calendar/mock';
import { files } from '../../features/files/mock';
import { inventory } from '../../features/inventory/mock';
import { locations } from '../../features/locations/mock';
import { tasks } from '../../features/tasks/mock';
import { tournaments } from '../../features/tournaments/mock';
import type { LinkedRef, RefKind } from '../records/refs';
import { PRIVILEGED, type Member } from '../types';
import { directory } from './core';
import { MockServer } from './MockServer';

/**
 * Resolves every kind but MEETING, which the caller passes in `meeting` (the meetings mock would otherwise import itself in a
 * cycle). Fails with `<code>.ref-unknown` for records the viewer cannot see.
 */
export function resolveRef(
  viewer: Member,
  ref: { kind: RefKind; id: string },
  code: string,
  meeting: (id: string) => string | null = () => null,
): LinkedRef {
  const titled = (title: string, parentId: string | null = null): LinkedRef => ({ kind: ref.kind, id: ref.id, title, parentId });
  try {
    switch (ref.kind) {
      case 'TASK':
        return titled(tasks.get(viewer, ref.id).title);
      case 'APPOINTMENT':
        return titled(calendar.visible(viewer, ref.id).title);
      case 'ITEM':
        directory.requireRole(viewer, PRIVILEGED);
        return titled(inventory.get(ref.id).name);
      case 'MEMBER': {
        const m = directory.get(viewer, ref.id);
        return titled(`${m.firstName} ${m.lastName}`);
      }
      case 'FILE': {
        const f = files.refs(viewer, [{ fileId: ref.id, folderId: null, name: null }]).find((r) => !r.deleted);
        if (f) return { ...titled(f.name, f.folderId), id: f.id };
        break;
      }
      case 'TEAM': {
        const team = directory.teams.data.find((t) => t.id === ref.id);
        if (team) return titled(team.name);
        break;
      }
      case 'LOCATION':
        return titled(locations.get(ref.id).name);
      case 'TOURNAMENT':
        return titled(tournaments.get(viewer, ref.id).name);
      case 'MEETING': {
        const title = meeting(ref.id);
        if (title) return titled(title);
        break;
      }
    }
  } catch {
    // not visible: refused below
  }
  return MockServer.fail(400, `${code}.ref-unknown`);
}
