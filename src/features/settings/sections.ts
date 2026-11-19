import type { Component } from 'svelte';
import AppointmentTypesSection from '../calendar/AppointmentTypesSection.svelte';
import MailboxesSection from '../mail/MailboxesSection.svelte';
import MeetingTypesSection from '../meetings/MeetingTypesSection.svelte';
import ResolutionRulesSection from '../meetings/ResolutionRulesSection.svelte';
import TemplatesSection from '../meetings/TemplatesSection.svelte';
import BoardSettingsSection from '../members/BoardSettingsSection.svelte';
import MembershipSection from '../members/MembershipSection.svelte';
import NotificationRulesSection from '../notifications/NotificationRulesSection.svelte';
import NotificationSettingsSection from '../notifications/NotificationSettingsSection.svelte';
import HolidaysSection from '../calendar/HolidaysSection.svelte';
import CalendarSettingsSection from '../calendar/CalendarSettingsSection.svelte';
import FileSettingsSection from '../files/FileSettingsSection.svelte';
import FeeSettingsSection from '../finance/FeeSettingsSection.svelte';
import FinanceSettingsSection from '../finance/FinanceSettingsSection.svelte';
import TaskSettingsSection from '../tasks/TaskSettingsSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import BrandView from './BrandView.svelte';
import ClubSection from './ClubSection.svelte';
import GeneralSection from './GeneralSection.svelte';
import HomeSettingsSection from './HomeSettingsSection.svelte';
import SecuritySection from './SecuritySection.svelte';
import ShortcutsSection from './ShortcutsSection.svelte';
import SidebarSection from './SidebarSection.svelte';
import type { SectionId } from './settingsTree';

/** The component of each settings section, for the page and the window (with SECTION_PROPS). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- views of several parts take their part as `id`
export const SETTINGS_SECTIONS: Record<SectionId, Component<any>> = {
  appearance: AppearanceSection,
  home: HomeSettingsSection,
  sidebar: SidebarSection,
  shortcuts: ShortcutsSection,
  security: SecuritySection,
  general: GeneralSection,
  club: ClubSection,
  'brand-look': BrandView,
  'brand-logos': BrandView,
  'brand-mail': BrandView,
  templates: TemplatesSection,
  'meeting-types': MeetingTypesSection,
  membership: MembershipSection,
  offices: BoardSettingsSection,
  'resolution-rules': ResolutionRulesSection,
  'appointment-types': AppointmentTypesSection,
  holidays: HolidaysSection,
  'calendar-rules': CalendarSettingsSection,
  notifications: NotificationSettingsSection,
  'notification-rules': NotificationRulesSection,
  files: FileSettingsSection,
  tasks: TaskSettingsSection,
  mailboxes: MailboxesSection,
  finance: FinanceSettingsSection,
  'fees-due': FeeSettingsSection,
  'fees-payment': FeeSettingsSection,
};

/** Sections that show one part of a view of several parts. */
export const SECTION_PROPS: Partial<Record<SectionId, { id: string }>> = {
  'brand-look': { id: 'look' },
  'brand-logos': { id: 'logos' },
  'brand-mail': { id: 'mail' },
  'fees-due': { id: 'due' },
  'fees-payment': { id: 'payment' },
};
