import { accountFeature } from './account/feature';
import { activityFeature } from './activity/feature';
import { calendarFeature } from './calendar/feature';
import { FeatureRegistry } from './FeatureRegistry';
import { filesFeature } from './files/feature';
import { homeFeature } from './home/feature';
import { inventoryFeature } from './inventory/feature';
import { membersFeature } from './members/feature';
import { notificationsFeature } from './notifications/feature';
import { searchFeature } from './search/feature';
import { settingsFeature } from './settings/feature';
import { tasksFeature } from './tasks/feature';
import { teamsFeature } from './teams/feature';

/**
 * Enabled features in sidebar order. A new feature = a folder with feature.ts (routes, messages),
 * its services/models/pages, optionally mock.ts (picked up automatically) + one entry here.
 */
export const features = new FeatureRegistry([
  homeFeature,
  calendarFeature,
  tasksFeature,
  filesFeature,
  inventoryFeature,
  teamsFeature,
  notificationsFeature,
  membersFeature,
  activityFeature,
  accountFeature,
  settingsFeature,
  searchFeature,
]);
