import type { IconName } from '../../icons';
import type { Hue } from '../types';

/** Filter and colour groups of calendar items (server: platform.CalendarItems.Category). */
export type CalendarCategory = 'APPOINTMENT' | 'TASK' | 'FOLLOW_UP' | 'MEETING' | 'TOURNAMENT' | 'ABSENCE' | 'BIRTHDAY';

export interface CategoryInfo {
  id: CalendarCategory;
  /** Filter chip and default entry label. */
  label: string;
  hue: Hue;
  icon: IconName;
}

/** In the order of the filter chips. */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'APPOINTMENT', label: 'Termine', hue: 'blue', icon: 'calendar' },
  { id: 'TASK', label: 'Aufgaben', hue: 'orange', icon: 'tasks' },
  { id: 'FOLLOW_UP', label: 'Aus Sitzungen', hue: 'brown', icon: 'tasks' },
  { id: 'MEETING', label: 'Sitzungen', hue: 'purple', icon: 'meetings' },
  { id: 'TOURNAMENT', label: 'Turniere', hue: 'yellow', icon: 'trophy' },
  { id: 'ABSENCE', label: 'Abwesenheiten', hue: 'gray', icon: 'account' },
  { id: 'BIRTHDAY', label: 'Geburtstage', hue: 'green', icon: 'members' },
];

export const categoryInfo = (id: CalendarCategory): CategoryInfo => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
