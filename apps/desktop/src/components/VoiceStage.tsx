import type { Channel, Profile } from "@discord2/contracts";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useIsSpeaking, useParticipants, useRoomContext, useTracks } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-core";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createLocalScreenTracks, isRemoteParticipant, ParticipantEvent, Track, type Participant, type Room } from "livekit-client";
import { Camera, CameraOff, Cast, Expand, HeadphoneOff, Headphones, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, ScreenShareOff, Settings, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCallVolume, setCallVolume, type CallVolumeSource } from "../lib/callVolumes";
import { getRuntimeConfig, getSupabase } from "../lib/supabase";
import { APP_SETTINGS_EVENT, cameraDimensions, loadAppSettings, screenDimensions, type AppSettings } from "../lib/settings";

type RtcCredentials = { token: string; url: string; room: string };

interface VoiceStageProps {
  channel: Channel;
  profile: Profile;
  expanded: boolean;
  onMinimize(): void;
  onExpand(): void;
  onLeave(): void;
  onSettings(): void;
}

export function VoiceStage({ channel, profile, expanded, onMinimize, onExpand, onLeave, onSettings }: VoiceStageProps) {
  const [credentials, setCredentials] = useState<RtcCredentials | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [supabase, config] = await Promise.all([getSupabase(), getRuntimeConfig()]);
        const { data } = await supabase.auth.getSession();
        const response = await fetch(`${config.apiUrl}/api/rtc/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: JSON.stringify({ channelId: channel.id, canPublish: true }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Nao foi possivel entrar na chamada");
        if (active) setCredentials(result);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha na chamada");
      }
    })();
    return () => { active = false; };
  }, [channel.id]);

  const wrapper = expanded ? "voice-overlay" : "voice-pip-anchor";
  if (error) return <div className={wrapper}><div className="voice-error"><h2>Chamada indisponivel</h2><p>{error}</p><button className="primary-button" onClick={onLeave}>Sair da chamada</button></div></div>;
  if (!credentials) return <div className={wrapper}><div className="voice-loader"><span /><p>Conectando a {channel.name}...</p></div></div>;
  const media = loadAppSettings();
  return <div className={wrapper}>
    <LiveKitRoom token={credentials.token} serverUrl={credentials.url} connect audio={false} video={false} options={{ audioCaptureDefaults: audioOptions(media), videoCaptureDefaults: videoOptions(media), audioOutput: { deviceId: media.speakerId }, adaptiveStream: true, dynacast: true }} onDisconnected={onLeave}>
      <Stage channel={channel} profile={profile} expanded={expanded} onMinimize={onMinimize} onExpand={onExpand} onLeave={onLeave} onSettings={onSettings} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  </div>;
}

function Stage({ channel, profile, expanded, onMinimize, onExpand, onLeave, onSettings }: VoiceStageProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio]);
  const [mic, setMic] = useState(room.localParticipant.isMicrophoneEnabled);
  const [camera, setCamera] = useState(room.localParticipant.isCameraEnabled);
  const [deafened, setDeafened] = useState(false);
  const [picker, setPicker] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const presenceRef = useRef<RealtimeChannel | undefined>(undefined);
  const joinedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    const apply = async (settings = loadAppSettings()) => {
      try {
        setDeviceError("");
        await room.switchActiveDevice("audioinput", settings.microphoneId, settings.microphoneId !== "default");
        await room.switchActiveDevice("videoinput", settings.cameraId, settings.cameraId !== "default");
        await room.switchActiveDevice("audiooutput", settings.speakerId, settings.speakerId !== "default");
        const microphone = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
        if (microphone) await microphone.restartTrack(audioOptions(settings));
        const video = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
        if (video) await video.restartTrack(videoOptions(settings));
      } catch (cause) {
        setDeviceError(cause instanceof Error ? cause.message : "Nao foi possivel trocar o dispositivo");
      }
    };
    const changed = (event: Event) => void apply((event as CustomEvent<AppSettings>).detail);
    void apply();
    window.addEventListener(APP_SETTINGS_EVENT, changed);
    return () => window.removeEventListener(APP_SETTINGS_EVENT, changed);
  }, [room]);

  useEffect(() => {
    let disposed = false;
    void getSupabase().then((supabase) => {
      if (disposed) return;
      const lobby = supabase.channel(`voice-lobby:${channel.serverId}`, { config: { presence: { key: profile.id } } });
      presenceRef.current = lobby;
      lobby.subscribe((status) => {
        if (status === "SUBSCRIBED") void lobby.track(voicePresence(profile, channel.id, mic, deafened, joinedAtRef.current));
      });
    });
    return () => {
      disposed = true;
      const lobby = presenceRef.current;
      presenceRef.current = undefined;
      if (lobby) void getSupabase().then(async (supabase) => { await lobby.untrack(); await supabase.removeChannel(lobby); });
    };
  }, [channel.id, channel.serverId, profile.id]);

  useEffect(() => {
    if (presenceRef.current) void presenceRef.current.track(voicePresence(profile, channel.id, mic, deafened, joinedAtRef.current));
  }, [channel.id, deafened, mic, profile]);

  useEffect(() => {
    for (const participant of participants) {
      if (!isRemoteParticipant(participant)) continue;
      participant.setVolume(deafened ? 0 : getCallVolume(participant.identity, "microphone"), Track.Source.Microphone);
      participant.setVolume(deafened ? 0 : getCallVolume(participant.identity, "screen"), Track.Source.ScreenShareAudio);
    }
  }, [deafened, participants, cameraTracks, screenTracks]);

  const cameras = useMemo(() => new Map(cameraTracks.map((track) => [track.participant.identity, track])), [cameraTracks]);
  const previewParticipants = participants.slice(0, 4);

  if (!expanded) return <div className="voice-pip">
    <header><div><span className="live-dot" /><strong>{channel.name}</strong><small>{participants.length} conectado{participants.length === 1 ? "" : "s"}</small></div><button title="Expandir chamada" onClick={onExpand}><Expand /></button></header>
    <div className={`pip-participants count-${previewParticipants.length}`}>{previewParticipants.map((participant) => <MiniParticipant key={participant.identity} participant={participant} cameraTrack={cameras.get(participant.identity)} />)}</div>
    {participants.length > 4 && <span className="pip-more">+{participants.length - 4} na chamada</span>}
    <CallControls compact mic={mic} camera={camera} deafened={deafened} sharing={sharing} onMic={() => void toggleMic(room, mic, setMic, setDeviceError)} onCamera={() => void toggleCamera(room, camera, setCamera, setDeviceError)} onDeafen={() => setDeafened((value) => !value)} onShare={onExpand} onSettings={onSettings} onLeave={onLeave} />
  </div>;

  return <div className="stage-shell">
    <header className="stage-header"><div><span className="live-dot" /> AO VIVO</div><h3>{channel.name} · {participants.length} conectado{participants.length === 1 ? "" : "s"}</h3><button title="Minimizar e continuar navegando" onClick={onMinimize}><Minimize2 /></button></header>
    <div className={`participant-grid count-${Math.min(participants.length + screenTracks.length, 6)}`}>
      {deviceError && <div className="call-error">{deviceError}</div>}
      {screenTracks.map((track) => <TransmissionCard key={`${track.participant.identity}-screen`} track={track} deafened={deafened} />)}
      {participants.map((participant) => <ParticipantCard key={participant.identity} participant={participant} cameraTrack={cameras.get(participant.identity)} deafened={deafened} />)}
    </div>
    <CallControls mic={mic} camera={camera} deafened={deafened} sharing={sharing} onMic={() => void toggleMic(room, mic, setMic, setDeviceError)} onCamera={() => void toggleCamera(room, camera, setCamera, setDeviceError)} onDeafen={() => setDeafened((value) => !value)} onShare={() => sharing ? void stopShare(room, () => setSharing(false)) : setPicker(true)} onSettings={onSettings} onLeave={onLeave} />
    {picker && <ScreenPicker onClose={() => setPicker(false)} onStarted={() => { setSharing(true); setPicker(false); }} />}
  </div>;
}

function ParticipantCard({ participant, cameraTrack, deafened }: { participant: Participant; cameraTrack?: TrackReference; deafened: boolean }) {
  const speaking = useIsSpeaking(participant);
  const [, revise] = useState(0);
  useEffect(() => {
    const update = () => revise((value) => value + 1);
    participant.on(ParticipantEvent.TrackMuted, update).on(ParticipantEvent.TrackUnmuted, update).on(ParticipantEvent.TrackPublished, update).on(ParticipantEvent.TrackUnpublished, update);
    return () => { participant.off(ParticipantEvent.TrackMuted, update).off(ParticipantEvent.TrackUnmuted, update).off(ParticipantEvent.TrackPublished, update).off(ParticipantEvent.TrackUnpublished, update); };
  }, [participant]);
  const muted = !participant.isMicrophoneEnabled;
  const avatar = participantAvatar(participant);
  return <article className={`participant-card ${speaking ? "speaking" : ""}`}>
    {cameraTrack ? <VideoTrack trackRef={cameraTrack} /> : <div className="participant-identity">{avatar ? <img src={avatar} alt="" /> : <span>{initials(participant.name || participant.identity)}</span>}</div>}
    <div className="participant-label"><span>{muted ? <MicOff /> : <Mic />}{participant.name || participant.identity}{participant.isLocal && <small>Voce</small>}</span>{cameraTrack && <Camera />}</div>
    {!participant.isLocal && isRemoteParticipant(participant) && <VolumeControl participant={participant} source="microphone" disabled={deafened} />}
  </article>;
}

function MiniParticipant({ participant, cameraTrack }: { participant: Participant; cameraTrack?: TrackReference }) {
  const speaking = useIsSpeaking(participant);
  const avatar = participantAvatar(participant);
  return <div className={`pip-person ${speaking ? "speaking" : ""}`} title={participant.name || participant.identity}>
    {cameraTrack ? <VideoTrack trackRef={cameraTrack} /> : avatar ? <img src={avatar} alt="" /> : <span>{initials(participant.name || participant.identity)}</span>}
    <i>{participant.isMicrophoneEnabled ? <Mic /> : <MicOff />}</i>
  </div>;
}

function TransmissionCard({ track, deafened }: { track: TrackReference; deafened: boolean }) {
  return <article className="participant-card transmission-card"><VideoTrack trackRef={track} /><div className="participant-label"><span><MonitorUp />{track.participant.name || track.participant.identity}<small>Transmissao</small></span></div>{isRemoteParticipant(track.participant) && <VolumeControl participant={track.participant} source="screen" disabled={deafened} />}</article>;
}

function VolumeControl({ participant, source, disabled }: { participant: Participant; source: CallVolumeSource; disabled: boolean }) {
  const [volume, setVolume] = useState(() => getCallVolume(participant.identity, source));
  const trackSource = source === "microphone" ? Track.Source.Microphone : Track.Source.ScreenShareAudio;
  const change = (next: number) => {
    setVolume(next);
    setCallVolume(participant.identity, source, next);
    if (isRemoteParticipant(participant)) participant.setVolume(disabled ? 0 : next, trackSource);
  };
  return <label className="participant-volume" title={source === "microphone" ? "Volume desta pessoa apenas para voce" : "Volume desta transmissao apenas para voce"}><Volume2 /><input type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(event) => change(Number(event.target.value) / 100)} disabled={disabled} /><b>{Math.round(volume * 100)}%</b></label>;
}

function CallControls({ compact = false, mic, camera, deafened, sharing, onMic, onCamera, onDeafen, onShare, onSettings, onLeave }: { compact?: boolean; mic: boolean; camera: boolean; deafened: boolean; sharing: boolean; onMic(): void; onCamera(): void; onDeafen(): void; onShare(): void; onSettings(): void; onLeave(): void }) {
  return <div className={`call-controls ${compact ? "compact" : ""}`}><button className={mic ? "active" : ""} title={mic ? "Desativar microfone" : "Ativar microfone"} onClick={onMic}>{mic ? <Mic /> : <MicOff />}</button><button className={deafened ? "danger" : ""} title={deafened ? "Ativar audio" : "Silenciar todo o audio"} onClick={onDeafen}>{deafened ? <HeadphoneOff /> : <Headphones />}</button>{!compact && <button className={camera ? "active" : ""} title={camera ? "Desativar camera" : "Ativar camera"} onClick={onCamera}>{camera ? <Camera /> : <CameraOff />}</button>}<button className={sharing ? "active wide" : "wide"} title={sharing ? "Parar transmissao" : "Compartilhar tela"} onClick={onShare}>{sharing ? <ScreenShareOff /> : <MonitorUp />}{!compact && <span>{sharing ? "Parar tela" : "Compartilhar"}</span>}</button>{!compact && <button title="Dispositivos" onClick={onSettings}><Settings /></button>}<button className="hangup" title="Sair da chamada" onClick={onLeave}><PhoneOff /></button></div>;
}

async function toggleMic(room: Room, current: boolean, set: (value: boolean) => void, error: (message: string) => void) {
  const next = !current;
  try { await room.localParticipant.setMicrophoneEnabled(next, audioOptions(loadAppSettings())); set(next); } catch (cause) { error(cause instanceof Error ? cause.message : "Falha no microfone"); }
}

async function toggleCamera(room: Room, current: boolean, set: (value: boolean) => void, error: (message: string) => void) {
  const next = !current;
  try { await room.localParticipant.setCameraEnabled(next, videoOptions(loadAppSettings())); set(next); } catch (cause) { error(cause instanceof Error ? cause.message : "Falha na camera"); }
}

async function stopShare(room: Room, done: () => void) {
  for (const publication of room.localParticipant.trackPublications.values()) {
    if ((publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) && publication.track) await room.localParticipant.unpublishTrack(publication.track, true);
  }
  done();
}

function voicePresence(profile: Profile, channelId: string, microphoneEnabled: boolean, deafened: boolean, joinedAt: string) {
  return { userId: profile.id, channelId, displayName: profile.displayName, username: profile.username, avatarUrl: profile.avatarUrl, muted: !microphoneEnabled, deafened, joinedAt };
}

function participantAvatar(participant: Participant) {
  try { return (JSON.parse(participant.metadata || "{}") as { avatarUrl?: string | null }).avatarUrl || null; } catch { return null; }
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function ScreenPicker({ onClose, onStarted }: { onClose(): void; onStarted(): void }) {
  const room = useRoomContext();
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selected, setSelected] = useState("");
  const initial = loadAppSettings();
  const [resolution, setResolution] = useState(initial.screenResolution);
  const [fps, setFps] = useState(initial.screenFps);
  const [audio, setAudio] = useState(initial.screenAudio);
  const [preview, setPreview] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void window.discord2.screens.list().then((items) => { setSources(items); if (items[0]) setSelected(items[0].id); }); }, []);
  async function start() {
    try {
      await window.discord2.screens.select(selected, audio);
      const size = screenDimensions(resolution);
      const localTracks = await createLocalScreenTracks({ audio, resolution: { width: size.width, height: size.height, frameRate: fps }, contentHint: "detail" });
      for (const track of localTracks) await room.localParticipant.publishTrack(track, { simulcast: true });
      onStarted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nao foi possivel compartilhar"); }
  }
  return <div className="picker-backdrop"><div className="screen-picker"><header><div><Cast /><span><strong>Compartilhar tela</strong><small>Escolha o que os participantes vao ver</small></span></div><button onClick={onClose}><X /></button></header><div className="source-grid">{sources.map((source) => <button className={selected === source.id ? "selected" : ""} key={source.id} onClick={() => setSelected(source.id)}><img src={source.thumbnail} /><span>{source.name}</span></button>)}</div>{preview && selected && <div className="preview-strip"><span>Pre-visualizacao ativa</span><strong>{sources.find((source) => source.id === selected)?.name}</strong></div>}<div className="share-settings"><label>Resolucao<select value={resolution} onChange={(event) => setResolution(event.target.value as AppSettings["screenResolution"])}><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="1440p">1440p</option><option value="source">Original</option></select></label><label>FPS<select value={fps} onChange={(event) => setFps(Number(event.target.value) as AppSettings["screenFps"])}><option>5</option><option>15</option><option>30</option><option>60</option></select></label><label className="toggle-row"><input type="checkbox" checked={audio} onChange={(event) => setAudio(event.target.checked)} /><span>Audio do sistema</span></label><label className="toggle-row"><input type="checkbox" checked={preview} onChange={(event) => setPreview(event.target.checked)} /><span>Previa local</span></label></div>{error && <div className="form-error">{error}</div>}<footer><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!selected} onClick={() => void start()}><MonitorUp /> Iniciar transmissao</button></footer></div></div>;
}

function audioOptions(settings: AppSettings) {
  return { deviceId: settings.microphoneId, noiseSuppression: settings.noiseSuppression, echoCancellation: settings.echoCancellation, autoGainControl: settings.autoGainControl };
}

function videoOptions(settings: AppSettings) {
  return { deviceId: settings.cameraId, resolution: cameraDimensions(settings.cameraResolution) };
}
