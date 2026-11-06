import type { Component } from 'svelte';
import AppointmentTypesSection from '../calendar/AppointmentTypesSection.svelte';
import MailboxesSection from '../mail/MailboxesSection.svelte';
import MeetingTypesSection from '../meetings/MeetingTypesSection.svelte';
import ResolutionRulesSection from '../meetings/ResolutionRulesSection.svelte';
import BoardSettingsSection from '../members/BoardSettingsSection.svelte';
import MembershipSection from '../members/MembershipSection.svelte';
import NotificationSettingsSection from '../notifications/NotificationSettingsSection.svelte';
import HolidaysSection from '../calendar/HolidaysSection.svelte';
import FileSettingsSection from '../files/FileSettingsSection.svelte';
import TaskSettingsSection from '../tasks/TaskSettingsSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import AuditSection from './AuditSection.svelte';
import BrandSection from './BrandSection.svelte';
import ClubSection from './ClubSection.svelte';
import GeneralSection from './GeneralSection.svelte';
import HomeSettingsSection from './HomeSettingsSection.svelte';
import SecuritySection from './SecuritySection.svelte';
import ShortcutsSection from './ShortcutsSection.svelte';
import SidebarSection from './SidebarSection.svelte';
import type { SectionId } from './settingsTree';

/** The component of each settings section, for the page and the window. */
export const SETTINGS_SECTIONS: Record<SectionId, Component> = {
  appearance: AppearanceSection,
  home: HomeSettingsSection,
  sidebar: SidebarSection,
  shortcuts: ShortcutsSection,
  security: SecuritySection,
  general: GeneralSection,
  club: ClubSection,
  brand: BrandSection,
  'meeting-types': MeetingTypesSection,
  membership: MembershipSection,
  offices: BoardSettingsSection,
  'resolution-rules': ResolutionRulesSection,
  'appointment-types': AppointmentTypesSection,
  holidays: HolidaysSection,
  notifications: NotificationSettingsSection,
  files: FileSettingsSection,
  tasks: TaskSettingsSection,
  mailboxes: MailboxesSection,
  audit: AuditSection,
};
