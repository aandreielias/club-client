import type { ApiClient } from '../../lib/http/ApiClient';
import type {
  Absence,
  AbsenceList,
  Appointment,
  AppointmentList,
  AppointmentPatch,
  AppointmentTypeInfo,
  AppointmentTypeInput,
  Attendance,
  AttendanceResponse,
  FeedLink,
  NewAppointment,
  NewAbsence,
  ResponseStatus,
  Ride,
  RideList,
} from './model';

/** Typed access to the calendar and attendance endpoints of club-server. */
export class CalendarApi {
  static readonly APPOINTMENTS = '/api/v1/appointments';
  static readonly FEED = '/api/v1/me/ical-token';

  constructor(private readonly api: ApiClient) {}

  /** Visible appointments overlapping [from, to) (UTC instants, at most 366 days), incl. cancelled ones. */
  async types(): Promise<AppointmentTypeInfo[]> {
    return (await this.api.get<{ items: AppointmentTypeInfo[] }>('/api/v1/calendar/types')).items;
  }

  /** Admin/board with step-up; `key` null creates a type. */
  saveType(key: string | null, type: AppointmentTypeInput): Promise<AppointmentTypeInfo> {
    return key ? this.api.put<AppointmentTypeInfo>(`/api/v1/calendar/types/${encodeURIComponent(key)}`, type)
      : this.api.post<AppointmentTypeInfo>('/api/v1/calendar/types', type);
  }

  /** Only types no appointment uses (`appointment-type.in-use`); archive the others. */
  deleteType(key: string): Promise<void> {
    return this.api.delete(`/api/v1/calendar/types/${encodeURIComponent(key)}`);
  }

  async list(from: string, to: string, teamId: string | null): Promise<Appointment[]> {
    const { items } = await this.api.get<AppointmentList>(CalendarApi.APPOINTMENTS, { from, to, teamId });
    return items;
  }

  get(id: string): Promise<Appointment> {
    return this.api.get<Appointment>(this.path(id));
  }

  /** Creates one appointment or a weekly series; returns every created occurrence. */
  async create(appointment: NewAppointment): Promise<Appointment[]> {
    return (await this.api.post<AppointmentList>(CalendarApi.APPOINTMENTS, appointment)).items;
  }

  update(id: string, patch: AppointmentPatch): Promise<Appointment> {
    return this.api.patch<Appointment>(this.path(id), patch);
  }

  /** Cancels the occurrence, or it and all later ones of its series. Returns the cancelled ones. */
  async cancel(id: string, includeFollowing: boolean): Promise<Appointment[]> {
    return (await this.api.post<AppointmentList>(`${this.path(id)}/cancel`, undefined, { includeFollowing })).items;
  }

  attendance(id: string): Promise<Attendance> {
    return this.api.get<Attendance>(`${this.path(id)}/attendance`);
  }

  /** Answers for oneself (memberId null) or for one's minor. */
  respond(id: string, status: ResponseStatus, reason: string | null, memberId: string | null = null): Promise<AttendanceResponse> {
    return this.api.put<AttendanceResponse>(`${this.path(id)}/attendance`, { memberId, status, reason });
  }

  /** Creates or rotates the personal iCal feed; the absolute URL is only available now. */
  async issueFeed(): Promise<string> {
    const { url } = await this.api.post<FeedLink>(CalendarApi.FEED);
    return this.api.url(url);
  }

  revokeFeed(): Promise<void> {
    return this.api.delete(CalendarApi.FEED);
  }

  private path(id: string): string {
    return `${CalendarApi.APPOINTMENTS}/${encodeURIComponent(id)}`;
  }

  /** Current and future absences of the member and their minors. */
  async absences(): Promise<Absence[]> {
    return (await this.api.get<AbsenceList>('/api/v1/me/absences')).items;
  }

  addAbsence(absence: NewAbsence): Promise<Absence> {
    return this.api.post<Absence>('/api/v1/me/absences', absence);
  }

  deleteAbsence(id: string): Promise<void> {
    return this.api.delete(`/api/v1/me/absences/${encodeURIComponent(id)}`);
  }

  /** Car pools of the appointment. */
  async rides(appointmentId: string): Promise<Ride[]> {
    return (await this.api.get<RideList>(`${this.path(appointmentId)}/rides`)).items;
  }

  offerRide(appointmentId: string, seats: number, note: string | null): Promise<Ride> {
    return this.api.post<Ride>(`${this.path(appointmentId)}/rides`, { seats, note });
  }

  cancelRide(rideId: string): Promise<void> {
    return this.api.delete(`/api/v1/rides/${encodeURIComponent(rideId)}`);
  }

  /** Takes a seat for oneself (memberId null) or for one's minor. */
  joinRide(rideId: string, memberId: string | null = null): Promise<Ride> {
    return this.api.put<Ride>(`/api/v1/rides/${encodeURIComponent(rideId)}/passengers`, { memberId });
  }

  leaveRide(rideId: string, memberId: string): Promise<Ride> {
    return this.api.delete<Ride>(`/api/v1/rides/${encodeURIComponent(rideId)}/passengers/${encodeURIComponent(memberId)}`);
  }
}
