import type { Channel, Profile } from "@discord2/contracts";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { ChevronDown, Expand, Hash, HeadphoneOff, Headphones, LogOut, MicOff, MoveRight, PhoneOff, Plus, Users, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { AppSettingsModal } from "./components/AppSettingsModal";
import { ChatPane } from "./components/ChatPane";
import { Avatar, DirectChat, DirectSidebar, UserBar } from "./components/DirectMessages";
import { InviteModal } from "./components/InviteModal";
import { ServerModal } from "./components/ServerModal";
import { ServerSettingsModal, type ServerSettingsTab } from "./components/ServerSettingsModal";
import { UpdateBanner } from "./components/UpdateBanner";
import { VoiceStage } from "./components/VoiceStage";
import { usePresence } from "./hooks/usePresence";
import { useVoiceLobby, type VoiceLobbyMember } from "./hooks/useVoiceLobby";
import { canServer, issueVoiceCommand, loadConversations, loadMembers, loadWorkspace, type DirectConversation, type ServerBundle, type ServerMember } from "./lib/data";
import { getSupabase } from "./lib/supabase";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [servers, setServers] = useState<ServerBundle[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string>();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);
  const [voiceExpanded, setVoiceExpanded] = useState(true);
  const [serverModal, setServerModal] = useState(false);
  const [serverSettings, setServerSettings] = useState<{ serverId: string; tab: ServerSettingsTab; kind?: "text" | "voice" }>();
  const [appSettings, setAppSettings] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");

  const refresh = useCallback(async (current = session) => {
    if (!current) return;
    const workspace = await loadWorkspace(current.user);
    setProfile(workspace.profile); setServers(workspace.servers);
    setConversations(await loadConversations(current.user.id));
    setActiveServerId((selected) => selected && workspace.servers.some((server) => server.id === selected) ? selected : selected === null ? null : workspace.servers[0]?.id ?? null);
  }, [session]);

  useEffect(() => {
    let subscription: { unsubscribe(): void } | undefined;
    void getSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession(); setSession(data.session);
      if (data.session) await refresh(data.session);
      const listener = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (next) void refresh(next); else { setProfile(null); setServers([]); } });
      subscription = listener.data.subscription;
    }).catch((cause) => setFatal(cause instanceof Error ? cause.message : "Configuracao invalida")).finally(() => setLoading(false));
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => window.discord2?.deepLinks.onInvite((code) => setInviteCode(code)), []);

  const activeServer = servers.find((server) => server.id === activeServerId);
  const activeChannel = activeServer?.channels.find((channel) => channel.id === activeChannelId && channel.kind === "text") ?? activeServer?.channels.find((channel) => channel.kind === "text");
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  async function logout() {
    const supabase = await getSupabase(); await supabase.auth.signOut();
    setSession(null); setProfile(null); setServers([]); setActiveServerId(null); setActiveConversationId(undefined); setVoiceChannel(null);
  }

  if (loading) return <div className="splash"><div className="splash-logo"><img src="/fungocord.png" alt="FungoCord" /></div><span /></div>;
  if (fatal) return <div className="setup-error"><img className="setup-logo" src="/fungocord.png" alt="FungoCord" /><h1>Configuracao necessaria</h1><p>{fatal}</p><code>Copie .env.example para .env e preencha as chaves.</code></div>;
  if (!session || !profile) return <AuthScreen />;

  return <div className="app-shell">
    <ServerRail servers={servers} activeId={activeServerId} onHome={() => { setActiveServerId(null); setActiveChannelId(undefined); }} onSelect={(id) => { setActiveServerId(id); setActiveChannelId(undefined); }} onAdd={() => setServerModal(true)} />
    {activeServer ? <ChannelSidebar server={activeServer} profile={profile} activeChannelId={activeChannel?.id} voiceChannel={voiceChannel} onChannel={(channel) => { if (channel.kind === "voice") { setVoiceChannel(channel); setVoiceExpanded(true); } else setActiveChannelId(channel.id); }} onResumeCall={() => setVoiceExpanded(true)} onLeaveCall={() => setVoiceChannel(null)} onSettings={(tab, kind) => setServerSettings({ serverId: activeServer.id, tab, kind })} onAppSettings={() => setAppSettings(true)} onLogout={() => void logout()} /> : <DirectSidebar profile={profile} conversations={conversations} activeId={activeConversationId} onOpen={setActiveConversationId} onRefresh={async () => setConversations(await loadConversations(profile.id))} onSettings={() => setAppSettings(true)} onLogout={() => void logout()} />}
    {activeServer ? <ChatPane channel={activeChannel} profile={profile} /> : <DirectChat conversation={activeConversation} me={profile} />}
    {activeServer && <MemberPanel serverId={activeServer.id} me={profile} />}
    {voiceChannel && <VoiceStage key={voiceChannel.id} channel={voiceChannel} profile={profile} expanded={voiceExpanded} onMinimize={() => setVoiceExpanded(false)} onExpand={() => setVoiceExpanded(true)} onLeave={() => setVoiceChannel(null)} onMove={(channelId) => { const next = servers.flatMap((server) => server.channels).find((channel) => channel.id === channelId && channel.kind === "voice"); if (next) { setActiveServerId(next.serverId); setVoiceChannel(next); setVoiceExpanded(true); } }} onSettings={() => setAppSettings(true)} />}
    {serverModal && <ServerModal onClose={() => setServerModal(false)} onDone={() => refresh()} />}
    {serverSettings && (() => { const selected = servers.find((server) => server.id === serverSettings.serverId); return selected ? <ServerSettingsModal server={selected} profile={profile} initialTab={serverSettings.tab} initialKind={serverSettings.kind} onClose={() => setServerSettings(undefined)} onChanged={() => refresh()} onDeleted={async () => { setActiveServerId(null); setServerSettings(undefined); await refresh(); }} /> : null; })()}
    {appSettings && <AppSettingsModal onClose={() => setAppSettings(false)} />}
    {inviteCode && <InviteModal code={inviteCode} onClose={() => setInviteCode(undefined)} onAccepted={async (serverId) => { await refresh(); setActiveServerId(serverId); setActiveChannelId(undefined); }} />}
    <UpdateBanner />
  </div>;
}

function ServerRail({ servers, activeId, onHome, onSelect, onAdd }: { servers: ServerBundle[]; activeId: string | null; onHome(): void; onSelect(id: string): void; onAdd(): void }) {
  return <nav className="server-rail"><button className={`server-button home ${activeId === null ? "active" : ""}`} onClick={onHome} title="Inicio"><img src="/fungocord.png" alt="FungoCord" /></button><div className="rail-separator" />{servers.map((server) => <button className={`server-button ${activeId === server.id ? "active" : ""}`} key={server.id} onClick={() => onSelect(server.id)} title={server.name}>{server.iconUrl ? <img src={server.iconUrl} /> : server.name.slice(0, 2).toUpperCase()}</button>)}<button className="server-button add" onClick={onAdd} title="Adicionar servidor"><Plus /></button></nav>;
}

function ChannelSidebar({ server, profile, activeChannelId, voiceChannel, onChannel, onResumeCall, onLeaveCall, onSettings, onAppSettings, onLogout }: { server: ServerBundle; profile: Profile; activeChannelId?: string; voiceChannel: Channel | null; onChannel(channel: Channel): void; onResumeCall(): void; onLeaveCall(): void; onSettings(tab: ServerSettingsTab, kind?: "text" | "voice"): void; onAppSettings(): void; onLogout(): void }) {
  const text = server.channels.filter((channel) => channel.kind === "text");
  const voice = server.channels.filter((channel) => channel.kind === "voice");
  const voiceMembers = useVoiceLobby(server.id);
  const connectedHere = voiceChannel?.serverId === server.id;
  const canMove = canServer(server, "move_members");
  const canDisconnect = canServer(server, "disconnect_members");
  const [context, setContext] = useState<{ member: VoiceLobbyMember; x: number; y: number }>();
  const [moderationError, setModerationError] = useState("");
  useEffect(() => { const close = () => setContext(undefined); window.addEventListener("pointerdown", close); return () => window.removeEventListener("pointerdown", close); }, []);
  async function command(member: VoiceLobbyMember, action: "disconnect" | "move", target?: string) {
    setContext(undefined); setModerationError("");
    try { await issueVoiceCommand(server.id, member.userId, action, target); }
    catch (cause) { setModerationError(cause instanceof Error ? cause.message : "Acao de voz indisponivel"); }
  }
  function dropped(event: React.DragEvent, channelId: string) {
    event.preventDefault();
    if (!canMove) return;
    try { const member = JSON.parse(event.dataTransfer.getData("application/fungocord-voice-member")) as VoiceLobbyMember; if (member.userId && member.channelId !== channelId) void command(member, "move", channelId); } catch { /* outro tipo de arraste */ }
  }
  return <aside className="channel-sidebar"><header className="server-header"><button className="server-settings-trigger" onClick={() => onSettings("overview")} title="Configuracoes do servidor"><strong>{server.name}</strong><ChevronDown /></button></header><div className="channel-scroll"><section><div className="section-label"><span>CANAIS DE TEXTO</span>{canServer(server, "manage_channels") && <button onClick={() => onSettings("channels", "text")}><Plus /></button>}</div>{text.map((channel) => <button className={`channel-item ${activeChannelId === channel.id ? "active" : ""}`} key={channel.id} onClick={() => onChannel(channel)}><Hash /><span>{channel.name}</span></button>)}</section><section><div className="section-label"><span>CANAIS DE VOZ</span>{canServer(server, "manage_channels") && <button onClick={() => onSettings("channels", "voice")}><Plus /></button>}</div>{voice.map((channel) => <div className={`voice-channel-block ${voiceChannel?.id === channel.id ? "connected" : ""}`} key={channel.id} onDragOver={(event) => { if (canMove) event.preventDefault(); }} onDrop={(event) => dropped(event, channel.id)}><button className="channel-item voice" onClick={() => onChannel(channel)}><Volume2 /><span>{channel.name}</span>{voiceMembers[channel.id]?.length ? <small>{voiceMembers[channel.id]?.length ?? 0}</small> : null}</button>{voiceMembers[channel.id]?.map((member) => <div className={`voice-member-row ${(canMove || canDisconnect) && member.userId !== profile.id ? "moderatable" : ""}`} key={member.userId} draggable={canMove && member.userId !== profile.id} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/fungocord-voice-member", JSON.stringify(member)); }} onContextMenu={(event) => { if ((!canMove && !canDisconnect) || member.userId === profile.id) return; event.preventDefault(); event.stopPropagation(); setContext({ member, x: event.clientX, y: event.clientY }); }}><div>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{member.displayName.slice(0, 1).toUpperCase()}</span>}</div><strong>{member.displayName}</strong>{member.deafened ? <HeadphoneOff /> : member.muted ? <MicOff /> : <i className="voice-speaking-dot" />}</div>)}</div>)}</section>{moderationError && <div className="voice-context-error">{moderationError}</div>}</div>{connectedHere ? <div className="voice-status connected"><Headphones /><div><strong>Voz conectada</strong><small>{voiceChannel?.name}</small></div><button title="Abrir chamada" onClick={onResumeCall}><Expand /></button><button className="disconnect" title="Sair da chamada" onClick={onLeaveCall}><PhoneOff /></button></div> : <div className="voice-status"><Headphones /><div><strong>Voz pronta</strong><small>Clique em um canal</small></div></div>}<UserBar profile={profile} onSettings={onAppSettings} onLogout={onLogout} />{context && <div className="voice-member-menu" style={{ left: context.x, top: context.y }} onPointerDown={(event) => event.stopPropagation()}><header><strong>{context.member.displayName}</strong><small>@{context.member.username}</small></header>{canDisconnect && <button className="danger" onClick={() => void command(context.member, "disconnect")}><LogOut /> Desconectar da call</button>}{canMove && <><span>MOVER PARA</span>{voice.filter((channel) => channel.id !== context.member.channelId).map((channel) => <button key={channel.id} onClick={() => void command(context.member, "move", channel.id)}><MoveRight /> {channel.name}</button>)}</>}</div>}</aside>;
}

function MemberPanel({ serverId, me }: { serverId: string; me: Profile }) {
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [error, setError] = useState("");
  const online = usePresence(serverId, me.id);
  useEffect(() => {
    let disposed = false;
    let realtime: RealtimeChannel | undefined;
    const reload = async () => { try { const next = await loadMembers(serverId); if (!disposed) { setMembers(next); setError(""); } } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : "Falha ao carregar membros"); } };
    void reload();
    void getSupabase().then((supabase) => { if (disposed) return; realtime = supabase.channel(`member-list:${serverId}`).on("postgres_changes", { event: "*", schema: "public", table: "server_members", filter: `server_id=eq.${serverId}` }, () => void reload()).on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => void reload()).subscribe(); });
    return () => {
      disposed = true;
      const activeChannel = realtime;
      if (activeChannel) void getSupabase().then((supabase) => supabase.removeChannel(activeChannel));
    };
  }, [serverId]);
  const sorted = useMemo(() => [...members].sort((a, b) => Number(online.has(b.profile.id)) - Number(online.has(a.profile.id))), [members, online]);
  const onlineMembers = sorted.filter((member) => online.has(member.profile.id));
  const offlineMembers = sorted.filter((member) => !online.has(member.profile.id));
  const memberRow = (member: ServerMember, isOnline: boolean) => <div className={`member-row ${isOnline ? "" : "offline"}`} key={member.profile.id}><div className="member-avatar"><Avatar profile={member.profile} /><span className={isOnline ? "online-dot" : "offline-dot"} /></div><div><strong style={{ color: member.roles[0]?.color }}>{member.profile.displayName}</strong><small>{member.role === "owner" ? "Proprietario" : member.role === "admin" ? "Administrador" : member.roles[0]?.name ?? `@${member.profile.username}`}</small></div></div>;
  return <aside className="member-panel"><div className="members-title"><Users /><strong>Membros</strong><span>{members.length}</span></div>{error && <div className="notice error">{error}</div>}<div className="section-label">ONLINE — {onlineMembers.length}</div>{onlineMembers.map((member) => memberRow(member, true))}{offlineMembers.length > 0 && <><div className="section-label member-group-label">OFFLINE — {offlineMembers.length}</div>{offlineMembers.map((member) => memberRow(member, false))}</>}</aside>;
}
