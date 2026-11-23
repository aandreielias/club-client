// Compile-time contract check (run by `npm run check`): what the server sends (types generated from its OpenAPI snapshot by
// `npm run api:sync`) must satisfy the client's own DTO types, so a renamed, removed or retyped field fails the build.
// Not checked: whether a field may be null (the server's records write every field; nullability is not in the document).
import type { components } from './schema';
import type { RemotePreferences } from '../preferences/PreferencesService.svelte';
import type { Absence, AbsenceList, Appointment, AppointmentList, Attendance, CalendarSettings, Ride, RideList } from '../../features/calendar/model';
import type {
  DocumentKinds,
  DownloadLink,
  FileHits,
  FileList,
  FilePatch,
  FileSettings,
  FileVersion,
  FolderList,
  FolderPatch,
  SettingFileList,
} from '../../features/files/model';
import type {
  Account,
  Audit,
  AuditList,
  Booking,
  BookingList,
  Budget,
  BudgetLine,
  Category,
  Charge,
  ChargeList,
  FeePayment,
  FeeRate,
  FeeRates,
  FeeSettings,
  Invoice,
  InvoiceList,
  MyFees,
  Receipt,
} from '../../features/finance/model';
import type { Item, ItemList, ItemUse, OwnItem, StockInput } from '../../features/inventory/model';
import type { GeocodeResult, Location } from '../../features/locations/model';
import type { AddressEntry, Mail, Mailbox, MailboxAdmin, MailPage, MailRef, MailSettings, MailSummary } from '../../features/mail/model';
import type { CircularRules, InviteesInput, Meeting, MeetingType, Person, Resolution } from '../../features/meetings/model';
import type {
  Board,
  BoardSettings,
  ChangeRequest,
  Family,
  GuardianLink,
  GuardianRef,
  MembershipKind,
  Office,
  OfficePair,
  OfficeSetting,
  OrgChart,
  OrgPerson,
  Relative,
} from '../../features/members/MembersApi';
import type { Notification, NotificationList, NotificationSettings, Preference, Preferences } from '../../features/notifications/model';
import type { SearchHit, SearchResult } from '../../features/search/model';
import type { Task, TaskLabel, TaskLink, TaskList, TaskSettings, TaskStage } from '../../features/tasks/model';
import type { Reach } from '../reach';
import type { TeamInput, Tournament, TournamentSummary } from '../../features/tournaments/model';
import type { FeedEntry } from '../activity/ActivityApi';
import type { CalendarItem } from '../calendar/CalendarSources';
import type { FileRef, Links, Need } from '../links/model';
import type { AuditEntry, Brand, BrandAssets, Club, MailPreview, MailSample, Me, Member, MemberList, Roster, RosterEntry } from '../types';

type S = components['schemas'];
type Satisfies<Server extends Client, Client> = [Server, Client];
/** Where the client deliberately expects less than the server's type allows (a narrower union the server validates). */
type With<T, K extends keyof T, V> = Omit<T, K> & Record<K, V>;

/** @public Never imported: it exists so svelte-check compares each client DTO with its server schema. */
export type Contract = [
  Satisfies<S['at.clubserver.calendar.api.CalendarApi.AppointmentDto'], Appointment>,
  Satisfies<S['at.clubserver.calendar.api.CalendarApi.AppointmentList'], AppointmentList>,
  Satisfies<S['at.clubserver.calendar.api.CalendarApi.CalendarSettings'], CalendarSettings>,
  Satisfies<S['at.clubserver.attendance.api.AttendanceApi.Attendance'], Attendance>,
  Satisfies<S['at.clubserver.attendance.api.AttendanceApi.AbsenceDto'], Absence>,
  Satisfies<S['at.clubserver.attendance.api.AttendanceApi.AbsenceList'], AbsenceList>,
  Satisfies<S['at.clubserver.attendance.api.AttendanceApi.RideDto'], Ride>,
  Satisfies<S['at.clubserver.attendance.api.AttendanceApi.RideList'], RideList>,
  Satisfies<S['at.clubserver.files.api.FilesApi.FolderList'], FolderList>,
  Satisfies<S['at.clubserver.gateway.rest.FilesController.FolderPatch'], FolderPatch>,
  Satisfies<S['at.clubserver.gateway.rest.FilesController.FilePatch'], FilePatch>,
  Satisfies<S['at.clubserver.files.api.FilesApi.FileList'], FileList>,
  Satisfies<S['at.clubserver.files.api.FilesApi.DownloadLink'], DownloadLink>,
  Satisfies<S['at.clubserver.files.api.FilesApi.FileSettings'], FileSettings>,
  Satisfies<S['at.clubserver.files.api.FilesApi.VersionDto'], FileVersion>,
  Satisfies<S['at.clubserver.files.api.FilesApi.FileHits'], FileHits>,
  Satisfies<S['at.clubserver.files.api.FilesApi.SettingFileList'], SettingFileList>,
  Satisfies<S['at.clubserver.documents.api.DocumentsApi.KindList'], DocumentKinds>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.AccountDto'], Account>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.CategoryDto'], Category>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.ReceiptDto'], Receipt>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.BookingDto'], Booking>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.BookingList'], BookingList>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.AuditDto'], Audit>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.AuditList'], AuditList>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.Budget'], Budget>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.BudgetLine'], BudgetLine>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.FeeSettings'], FeeSettings>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.FeeRate'], FeeRate>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.FeeRates'], FeeRates>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.FeePaymentDto'], FeePayment>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.ChargeDto'], Charge>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.ChargeList'], ChargeList>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.MyFees'], MyFees>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.InvoiceDto'], Invoice>,
  Satisfies<S['at.clubserver.finance.api.FinanceApi.InvoiceList'], InvoiceList>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.ItemDto'], Item>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.ItemList'], ItemList>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.ItemUse'], ItemUse>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.StockInput'], StockInput>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.OwnItem'], OwnItem>,
  Satisfies<S['at.clubserver.locations.api.LocationsApi.LocationDto'], Location>,
  Satisfies<S['at.clubserver.locations.api.LocationsApi.GeocodeResult'], GeocodeResult>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailboxDto'], Mailbox>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailSummaryDto'], MailSummary>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailDto'], Mail>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailboxAdminDto'], MailboxAdmin>,
  Satisfies<S['at.clubserver.mail.api.MailApi.AddressEntry'], AddressEntry>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailRefDto'], MailRef>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailList'], MailPage>,
  Satisfies<S['at.clubserver.mail.api.MailApi.MailSettingsDto'], MailSettings>,
  Satisfies<With<S['at.clubserver.meetings.api.MeetingsApi.MeetingTypeDto'], 'hue', MeetingType['hue']>, MeetingType>, // the server keeps hues as strings
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.Person'], Person>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.MeetingDto'], Meeting>,
  Satisfies<S['at.clubserver.gateway.rest.MeetingsController.InviteesBody'], InviteesInput>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.CircularRules'], CircularRules>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.ResolutionDto'], Resolution>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OfficeDto'], Office>,
  Satisfies<S['at.clubserver.members.api.MembersApi.MembershipKindDto'], MembershipKind>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OfficePair'], OfficePair>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OfficeSetting'], OfficeSetting>,
  Satisfies<S['at.clubserver.members.api.MembersApi.BoardSettings'], BoardSettings>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Board'], Board>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OrgChart'], OrgChart>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OrgPerson'], OrgPerson>,
  Satisfies<S['at.clubserver.members.api.MembersApi.GuardianLink'], GuardianLink>,
  Satisfies<S['at.clubserver.members.api.MembersApi.ChangeRequestDto'], ChangeRequest>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Relative'], Relative>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Family'], Family>,
  Satisfies<S['at.clubserver.members.api.MembersApi.GuardianRef'], GuardianRef>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.NotificationDto'], Notification>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.NotificationList'], NotificationList>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.Preference'], Preference>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.Preferences'], Preferences>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Preferences'], RemotePreferences>,
  Satisfies<S['at.clubserver.gateway.rest.SearchController.SearchHit'], SearchHit>,
  Satisfies<S['at.clubserver.gateway.rest.SearchController.SearchResult'], SearchResult>,
  Satisfies<S['at.clubserver.tasks.api.TasksApi.TaskDto'], Task>,
  Satisfies<S['at.clubserver.platform.Reach'], Reach>,
  Satisfies<S['at.clubserver.tasks.api.TasksApi.TaskSettings'], TaskSettings>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.NotificationSettings'], NotificationSettings>,
  Satisfies<S['at.clubserver.tasks.api.TasksApi.TaskList'], TaskList>,
  Satisfies<S['at.clubserver.tasks.api.TasksApi.TaskLink'], TaskLink>,
  Satisfies<With<S['at.clubserver.tasks.api.TasksApi.StageDto'], 'hue', TaskStage['hue']>, TaskStage>, // the server keeps hues as strings
  Satisfies<With<S['at.clubserver.tasks.api.TasksApi.LabelDto'], 'hue', TaskLabel['hue']>, TaskLabel>,
  Satisfies<S['at.clubserver.tournaments.api.TournamentsApi.TournamentDto'], Tournament>,
  Satisfies<S['at.clubserver.tournaments.api.TournamentsApi.TournamentSummary'], TournamentSummary>,
  Satisfies<S['at.clubserver.tournaments.api.TournamentsApi.TeamInput'], TeamInput>,
  Satisfies<S['at.clubserver.activity.api.ActivityApi.FeedEntry'], FeedEntry>,
  Satisfies<S['at.clubserver.platform.CalendarItems.CalendarItem'], CalendarItem>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.Need'], Need>,
  Satisfies<S['at.clubserver.files.api.FilesApi.FileRef'], FileRef>,
  Satisfies<S['at.clubserver.platform.Links'], Links>,
  Satisfies<S['at.clubserver.platform.club.ClubSettings.Club'], Club>,
  Satisfies<S['at.clubserver.platform.club.Brand'], Brand>,
  Satisfies<S['at.clubserver.platform.club.BrandSettings.BrandAssets'], BrandAssets>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.MailPreview'], MailPreview>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.MailSample'], MailSample>,
  Satisfies<S['at.clubserver.members.api.MembersApi.MemberDto'], Member>,
  Satisfies<S['at.clubserver.members.api.MembersApi.MemberList'], MemberList>,
  Satisfies<S['at.clubserver.teams.api.TeamsApi.RosterEntry'], RosterEntry>,
  Satisfies<S['at.clubserver.teams.api.TeamsApi.Roster'], Roster>,
  Satisfies<With<S['at.clubserver.gateway.rest.MembersController.Me'], 'missing', Me['missing']>, Me>, // the server lists field names as strings
  Satisfies<S['at.clubserver.gateway.audit.AuditLog.AuditEntry'], AuditEntry>,
];
