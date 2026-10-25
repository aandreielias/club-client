import { accountFeature } from './account/feature';
import { activityFeature } from './activity/feature';
import { calendarFeature } from './calendar/feature';
import { FeatureRegistry } from './FeatureRegistry';
import { NavLayout } from '../lib/navigation/NavLayout';
import { filesFeature } from './files/feature';
import { homeFeature } from './home/feature';
import { inventoryFeature } from './inventory/feature';
import { locationsFeature } from './locations/feature';
import { meetingsFeature } from './meetings/feature';
import { membersFeature } from './members/feature';
import { notificationsFeature } from './notifications/feature';
import { searchFeature } from './search/feature';
import { settingsFeature } from './settings/feature';
import { tasksFeature } from './tasks/feature';
import { teamsFeature } from './teams/feature';
import { tournamentsFeature } from './tournaments/feature';

/** Sidebar groups (flyouts) and the default order of the top-level rows; members reorder rows, not group contents. */
const navLayout = new NavLayout(
  [
    { id: 'events', label: 'Events', icon: 'eventGroup', paths: ['/events', '/tournaments'] },
    { id: 'verein', label: 'Verein', icon: 'club', paths: ['/teams', '/members', '/board', '/meetings', '/deadlines', '/locations'] },
    { id: 'ablage', label: 'Ablage', icon: 'archive', paths: ['/files', '/inventory'] },
  ],
  ['/', '/notifications', '/tasks', '/calendar', 'group:events', 'group:verein', 'group:ablage', '/activity'],
);

/**
 * Enabled features (feature order: home sections, calendar sources). A new feature = a folder with feature.ts (routes, messages),
 * its services/models/pages, optionally mock.ts (picked up automatically) + one entry here.
 */
export const features = new FeatureRegistry([
  homeFeature,
  calendarFeature,
  tasksFeature,
  filesFeature,
  inventoryFeature,
  locationsFeature,
  tournamentsFeature,
  meetingsFeature,
  teamsFeature,
  notificationsFeature,
  membersFeature,
  activityFeature,
  accountFeature,
  settingsFeature,
  searchFeature,
], navLayout);
