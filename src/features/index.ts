import { accountFeature } from './account/feature';
import { activityFeature } from './activity/feature';
import { calendarFeature } from './calendar/feature';
import { FeatureRegistry } from './FeatureRegistry';
import { NavLayout } from '../lib/navigation/NavLayout';
import { filesFeature } from './files/feature';
import { financeFeature } from './finance/feature';
import { homeFeature } from './home/feature';
import { inventoryFeature } from './inventory/feature';
import { locationsFeature } from './locations/feature';
import { mailFeature } from './mail/feature';
import { meetingsFeature } from './meetings/feature';
import { membersFeature } from './members/feature';
import { notificationsFeature } from './notifications/feature';
import { searchFeature } from './search/feature';
import { settingsFeature } from './settings/feature';
import { tasksFeature } from './tasks/feature';
import { teamsFeature } from './teams/feature';
import { tournamentsFeature } from './tournaments/feature';

/** The sidebar tree, by what members do; its top-level order is the default (members reorder top-level rows only). */
const navLayout = new NavLayout(
  [
    '/',
    { id: 'kommunikation', label: 'Kommunikation', icon: 'send', children: ['/notifications', '/mail'] },
    { id: 'planung', label: 'Planung', icon: 'eventGroup', children: ['/calendar', '/events', '/tournaments', '/tasks'] },
    {
      id: 'verein',
      label: 'Verein',
      icon: 'club',
      children: [
        { id: 'personen', label: 'Personen', icon: 'members', children: ['/members', '/teams', '/board'] },
        { id: 'gremien', label: 'Gremien', icon: 'meetings', children: ['/meetings', '/resolutions'] },
      ],
    },
    {
      id: 'verwaltung',
      label: 'Verwaltung',
      icon: 'offices',
      children: ['/finance', { id: 'ablage', label: 'Ablage', icon: 'archive', children: ['/files', '/inventory', '/locations'] }, '/activity'],
    },
  ],
  // Orders saved before 2026-11: the old groups take the place of their new top-level row.
  { 'group:events': 'group:planung', 'group:ablage': 'group:verwaltung' },
);

/**
 * Enabled features (feature order: home sections, calendar sources). A new feature = a folder with feature.ts (routes, messages),
 * its services/models/pages, optionally mock.ts (picked up automatically) + one entry here.
 */
export const features = new FeatureRegistry(
  [
    homeFeature,
    calendarFeature,
    tasksFeature,
    filesFeature,
    inventoryFeature,
    financeFeature,
    locationsFeature,
    tournamentsFeature,
    meetingsFeature,
    teamsFeature,
    notificationsFeature,
    mailFeature,
    membersFeature,
    activityFeature,
    accountFeature,
    settingsFeature,
    searchFeature,
  ],
  navLayout,
);
