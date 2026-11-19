import type { MeetingsApi } from './MeetingsApi';
import { settings } from '../../settings';
import type { CallParticipant, CallTrack, Sdp } from './model';

/** Another participant as shown: their name and the media pulled from them so far. */
export interface CallPeer {
  memberId: string;
  name: string;
  stream: MediaStream;
}

const STUN: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const POLL_MS = 4_000;
/** The member's own tile in `speaking`/`featured`. */
export const SELF = 'self';

/**
 * The member's side of a meeting's video call: one peer connection to Cloudflare's SFU (Realtime), signalling through the server.
 * Own microphone and camera are pushed once; every other participant's tracks are pulled as they appear. Asking for the state every few
 * seconds keeps the member in the call (the server forgets who stops asking).
 * shortcut: tracks of participants who left stay on the connection until the member leaves; close them via the SFU's tracks/close for long calls.
 */
export class CallSession {
  peers = $state<CallPeer[]>([]);
  local = $state.raw<MediaStream | null>(null);
  micOn = $state(true);
  cameraOn = $state(true);
  joined = $state(false);
  /** Who is talking now (memberId or SELF), null in silence. */
  speaking = $state<string | null>(null);
  /** The last one who talked, for the speaker layout. */
  featured = $state<string | null>(null);

  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private readonly pulled = new Set<string>();
  /** Transceiver mid → who sends that track. */
  private readonly owners = new Map<string, string>();
  private readonly streams = new Map<string, MediaStream>();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Negotiations run one after another on the one connection. */
  private queue: Promise<unknown> = Promise.resolve();
  private audio: AudioContext | null = null;
  private readonly meters = new Map<string, AnalyserNode>();
  private meterTimer: ReturnType<typeof setInterval> | null = null;
  private loudAt = 0;

  constructor(
    private readonly api: MeetingsApi,
    private readonly meetingId: string,
    private readonly onError: (error: unknown) => void,
  ) {}

  async join(): Promise<void> {
    const state = await this.api.joinCall(this.meetingId);
    this.sessionId = state.sessionId;
    this.joined = true;
    this.pc = new RTCPeerConnection({ iceServers: STUN, bundlePolicy: 'max-bundle' });
    this.pc.ontrack = (e) => this.received(e);
    this.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
      // No camera (or refused): audio only, and without a microphone the member still sees and hears the others.
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null),
    );
    this.cameraOn = !!this.local?.getVideoTracks().length;
    this.micOn = !!this.local?.getAudioTracks().length;
    if (this.local?.getTracks().length) await this.run(() => this.push(this.local!));
    if (this.local) this.meter(SELF, this.local);
    this.meterTimer = setInterval(() => this.listen(), settings.meetings.callMeterMs);
    this.update(state.participants);
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  toggleMic(): void {
    this.micOn = !this.micOn;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = this.micOn));
  }

  toggleCamera(): void {
    this.cameraOn = !this.cameraOn;
    this.local?.getVideoTracks().forEach((t) => (t.enabled = this.cameraOn));
  }

  /** Stops everything; `notify` false when the page goes away and the server will forget the member anyway. */
  async leave(notify = true): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.meterTimer) clearInterval(this.meterTimer);
    this.timer = this.meterTimer = null;
    this.meters.clear();
    void this.audio?.close();
    this.audio = null;
    this.speaking = this.featured = null;
    this.local?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.local = null;
    this.peers = [];
    const was = this.joined;
    this.joined = false;
    if (was && notify) await this.api.leaveCall(this.meetingId).catch(() => {});
  }

  private async poll(): Promise<void> {
    try {
      const state = await this.api.call(this.meetingId);
      if (!state.sessionId) {
        await this.leave(false); // dropped (call ended, or away too long)
        return;
      }
      this.update(state.participants);
    } catch (error) {
      this.onError(error);
    }
  }

  /** Shows who is there and pulls the tracks not pulled yet. */
  private update(participants: CallParticipant[]): void {
    const others = participants.filter((p) => p.sessionId !== this.sessionId);
    this.peers = others.map((p) => ({ memberId: p.memberId, name: p.name, stream: this.stream(p.memberId) }));
    const fresh: CallTrack[] = others.flatMap((p) =>
      p.trackNames
        .filter((name) => !this.pulled.has(`${p.sessionId}/${name}`))
        .map((name) => ({ location: 'remote' as const, mid: null, trackName: name, sessionId: p.sessionId })),
    );
    if (!fresh.length) return;
    fresh.forEach((t) => this.pulled.add(`${t.sessionId}/${t.trackName}`));
    const owner = new Map(others.map((p) => [p.sessionId, p.memberId]));
    void this.run(() => this.pull(fresh, owner)).catch((error) => {
      fresh.forEach((t) => this.pulled.delete(`${t.sessionId}/${t.trackName}`));
      this.onError(error);
    });
  }

  private async push(media: MediaStream): Promise<void> {
    const pc = this.pc!;
    const transceivers = media.getTracks().map((track) => pc.addTransceiver(track, { direction: 'sendonly' }));
    await pc.setLocalDescription(await pc.createOffer());
    const tracks: CallTrack[] = transceivers.map((t) => ({ location: 'local', mid: t.mid, trackName: t.sender.track!.kind, sessionId: null }));
    const answer = await this.api.callTracks(this.meetingId, this.sdp(pc.localDescription!), tracks);
    if (answer.sessionDescription) await pc.setRemoteDescription(answer.sessionDescription);
  }

  private async pull(tracks: CallTrack[], owner: Map<string, string>): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const answer = await this.api.callTracks(this.meetingId, null, tracks);
    answer.tracks.forEach((t) => t.mid && t.sessionId && this.owners.set(t.mid, owner.get(t.sessionId)!));
    if (!answer.requiresImmediateRenegotiation || !answer.sessionDescription) return;
    await pc.setRemoteDescription(answer.sessionDescription);
    await pc.setLocalDescription(await pc.createAnswer());
    await this.api.renegotiateCall(this.meetingId, this.sdp(pc.localDescription!));
  }

  private received(e: RTCTrackEvent): void {
    const memberId = e.transceiver.mid ? this.owners.get(e.transceiver.mid) : undefined;
    if (!memberId) return;
    this.stream(memberId).addTrack(e.track);
    if (e.track.kind === 'audio') this.meter(memberId, this.stream(memberId));
    this.peers = this.peers.map((p) => (p.memberId === memberId ? { ...p, stream: this.stream(memberId) } : p));
  }

  /** Measures a stream's loudness for the speaker highlight. */
  private meter(id: string, stream: MediaStream): void {
    if (this.meters.has(id) || !stream.getAudioTracks().length || typeof AudioContext === 'undefined') return;
    this.audio ??= new AudioContext();
    const analyser = this.audio.createAnalyser();
    analyser.fftSize = 512;
    this.audio.createMediaStreamSource(stream).connect(analyser);
    this.meters.set(id, analyser);
  }

  /** The loudest one above the level speaks; the highlight holds a moment after silence so it does not flicker. */
  private listen(): void {
    const samples = new Uint8Array(256);
    let loudest: string | null = null;
    let max: number = settings.meetings.callSpeakingLevel;
    for (const [id, analyser] of this.meters) {
      if (id === SELF && !this.micOn) continue;
      analyser.getByteTimeDomainData(samples);
      const level = Math.sqrt(samples.reduce((sum, v) => sum + (v - 128) ** 2, 0) / samples.length) / 128;
      if (level > max) [max, loudest] = [level, id];
    }
    const now = Date.now();
    if (loudest) {
      this.loudAt = now;
      if (this.speaking !== loudest) this.speaking = loudest;
      if (this.featured !== loudest) this.featured = loudest;
    } else if (this.speaking && now - this.loudAt > settings.meetings.callSpeakingHoldMs) this.speaking = null;
  }

  private stream(memberId: string): MediaStream {
    let stream = this.streams.get(memberId);
    if (!stream) this.streams.set(memberId, (stream = new MediaStream()));
    return stream;
  }

  private sdp(d: RTCSessionDescription): Sdp {
    return { type: d.type as Sdp['type'], sdp: d.sdp };
  }

  private run<T>(step: () => Promise<T>): Promise<T> {
    const next = this.queue.then(step);
    this.queue = next.catch(() => {});
    return next;
  }
}
