// Public part of the settings feature: the tree of sections and its search, for the sidebar and the global search.
import { session } from '../../lib/container';
import { guestOnly } from '../../lib/types';
import type { SettingsViewer } from './settingsTree';

export { searchSettings, tabPath, visibleSettings, type SectionId } from './settingsTree';

/** The signed-in member as a viewer of the settings tree. */
export const settingsViewer = (): SettingsViewer => ({
  sees: (roles) => session.hasRole(...roles),
  guest: guestOnly(session.member.roles),
  finance: session.me?.financeAccess,
});
