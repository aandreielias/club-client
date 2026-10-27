// Compile-time contract check (run by `npm run check`): what the server sends (types generated from its OpenAPI snapshot by
// `npm run api:sync`) must satisfy the client's own DTO types, so a renamed, removed or retyped field fails the build.
// Not checked: whether a field may be null (the server's records write every field; nullability is not in the document).
import type { components } from './schema';
import type { Absence, AbsenceList, Appointment, AppointmentList, Attendance, Ride, RideList } from '../../features/calendar/model';
import type { DownloadLink, FileList, FilePatch, FolderList, FolderPatch } from '../../features/files/model';
import type { Item, ItemList, ItemUse, OwnItem, StockInput } from '../../features/inventory/model';
import type { GeocodeResult, Location } from '../../features/locations/model';
import type { ActionRule, Assignable, CircularRules, FollowUpRule, Meeting, MeetingType, Person, Presence, Resolution } from '../../features/meetings/model';
import type { Board, BoardSettings, ChangeRequest, Family, GuardianRef, MembershipKind, Office, OfficePair, OfficeSetting, Relative } from '../../features/members/MembersApi';
import type { Notification, NotificationList, Preference, Preferences } from '../../features/notifications/model';
import type { SearchHit, SearchResult } from '../../features/search/model';
import type { Task, TaskList } from '../../features/tasks/model';
import type { TeamInput, Tournament, TournamentSummary } from '../../features/tournaments/model';
import type { FeedEntry } from '../activity/ActivityApi';
import type { CalendarItem } from '../calendar/CalendarSources';
import type { FileRef, Links, Need } from '../links/model';
import type { AuditEntry, Club, Device, Me, Member, MemberList, Roster, RosterEntry, SecurityStatus, StepUp } from '../types';

type S = components['schemas'];
type Satisfies<Server extends Client, Client> = [Server, Client];
/** Where the client deliberately expects less than the server's type allows (a narrower union the server validates). */
type With<T, K extends keyof T, V> = Omit<T, K> & Record<K, V>;

export type Contract = [
  Satisfies<S['at.clubserver.calendar.api.CalendarApi.AppointmentDto'], Appointment>,
  Satisfies<S['at.clubserver.calendar.api.CalendarApi.AppointmentList'], AppointmentList>,
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
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.ItemDto'], Item>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.ItemList'], ItemList>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.ItemUse'], ItemUse>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.StockInput'], StockInput>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.OwnItem'], OwnItem>,
  Satisfies<S['at.clubserver.locations.api.LocationsApi.LocationDto'], Location>,
  Satisfies<S['at.clubserver.locations.api.LocationsApi.GeocodeResult'], GeocodeResult>,
  Satisfies<With<S['at.clubserver.meetings.api.MeetingsApi.MeetingTypeDto'], 'electorate', MeetingType['electorate']>, MeetingType>, // only BOARD/ASSEMBLY (MeetingType validates)
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.Person'], Person>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.Presence'], Presence>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.MeetingDto'], Meeting>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.Assignable'], Assignable>,
  Satisfies<With<S['at.clubserver.meetings.api.MeetingsApi.FollowUpRule'], 'kind', FollowUpRule['kind']>, FollowUpRule>, // rules never MANUAL
  Satisfies<With<S['at.clubserver.meetings.api.MeetingsApi.ActionRule'], 'followUps', FollowUpRule[]>, ActionRule>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.CircularRules'], CircularRules>,
  Satisfies<S['at.clubserver.meetings.api.MeetingsApi.ResolutionDto'], Resolution>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OfficeDto'], Office>,
  Satisfies<S['at.clubserver.members.api.MembersApi.MembershipKindDto'], MembershipKind>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OfficePair'], OfficePair>,
  Satisfies<S['at.clubserver.members.api.MembersApi.OfficeSetting'], OfficeSetting>,
  Satisfies<S['at.clubserver.members.api.MembersApi.BoardSettings'], BoardSettings>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Board'], Board>,
  Satisfies<S['at.clubserver.members.api.MembersApi.ChangeRequestDto'], ChangeRequest>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Relative'], Relative>,
  Satisfies<S['at.clubserver.members.api.MembersApi.Family'], Family>,
  Satisfies<S['at.clubserver.members.api.MembersApi.GuardianRef'], GuardianRef>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.NotificationDto'], Notification>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.NotificationList'], NotificationList>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.Preference'], Preference>,
  Satisfies<S['at.clubserver.notifications.api.NotificationsApi.Preferences'], Preferences>,
  Satisfies<S['at.clubserver.gateway.rest.SearchController.SearchHit'], SearchHit>,
  Satisfies<S['at.clubserver.gateway.rest.SearchController.SearchResult'], SearchResult>,
  Satisfies<S['at.clubserver.tasks.api.TasksApi.TaskDto'], Task>,
  Satisfies<S['at.clubserver.tasks.api.TasksApi.TaskList'], TaskList>,
  Satisfies<S['at.clubserver.tournaments.api.TournamentsApi.TournamentDto'], Tournament>,
  Satisfies<S['at.clubserver.tournaments.api.TournamentsApi.TournamentSummary'], TournamentSummary>,
  Satisfies<S['at.clubserver.tournaments.api.TournamentsApi.TeamInput'], TeamInput>,
  Satisfies<S['at.clubserver.activity.api.ActivityApi.FeedEntry'], FeedEntry>,
  Satisfies<S['at.clubserver.platform.CalendarItems.CalendarItem'], CalendarItem>,
  Satisfies<S['at.clubserver.inventory.api.InventoryApi.Need'], Need>,
  Satisfies<S['at.clubserver.files.api.FilesApi.FileRef'], FileRef>,
  Satisfies<S['at.clubserver.platform.Links'], Links>,
  Satisfies<S['at.clubserver.platform.club.ClubSettings.Club'], Club>,
  Satisfies<S['at.clubserver.members.api.MembersApi.MemberDto'], Member>,
  Satisfies<S['at.clubserver.members.api.MembersApi.MemberList'], MemberList>,
  Satisfies<S['at.clubserver.teams.api.TeamsApi.RosterEntry'], RosterEntry>,
  Satisfies<S['at.clubserver.teams.api.TeamsApi.Roster'], Roster>,
  Satisfies<With<S['at.clubserver.gateway.rest.MembersController.Me'], 'missing', Me['missing']>, Me>, // the server lists field names as strings
  Satisfies<S['at.clubserver.members.api.MembersApi.DeviceDto'], Device>,
  Satisfies<S['at.clubserver.members.api.MembersApi.SecurityStatus'], SecurityStatus>,
  Satisfies<S['at.clubserver.gateway.audit.AuditLog.AuditEntry'], AuditEntry>,
  Satisfies<S['at.clubserver.members.api.MembersApi.StepUp'], StepUp>,
];
