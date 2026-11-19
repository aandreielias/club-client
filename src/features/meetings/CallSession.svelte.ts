import type { MeetingsApi } from './MeetingsApi';
import type { CallParticipant, CallTrack, Sdp } from './model';

/** Another participant as shown: their name and the media pulled from them so far. */
export interface CallPeer {
  memberId: string;
  name: string;
  stream: MediaStream;
}

const STUN: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const POLL_MS = 4_000;

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

  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private readonly pulled = new Set<string>();
  /** Transceiver mid → who sends that track. */
  private readonly owners = new Map<string, string>();
  private readonly streams = new Map<string, MediaStream>();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Negotiations run one after another on the one connection. */
  private queue: Promise<unknown> = Promise.resolve();

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
    this.timer = null;
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
    this.peers = this.peers.map((p) => (p.memberId === memberId ? { ...p, stream: this.stream(memberId) } : p));
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
