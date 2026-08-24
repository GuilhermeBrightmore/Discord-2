import type { Channel, Profile } from "@discord2/contracts";
import { Ban, ClipboardList, Copy, Crown, Hash, Pencil, Plus, Save, Settings, Shield, Trash2, UserMinus, Users, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SERVER_PERMISSIONS, banMember, canServer, createChannel, createInvite, createServerRole,
  deleteChannel, deleteServer, deleteServerRole, kickMember, loadAuditLogs, loadBans, loadMembers, loadServerRoles,
  setMemberRole, unbanMember, updateChannel, updateServer, updateServerRole,
  type AuditEntry, type ServerBan, type ServerBundle, type ServerMember, type ServerPermission, type ServerRole,
} from "../lib/data";

export type ServerSettingsTab = "overview" | "channels" | "roles" | "members" | "bans" | "audit";

const permissionLabels: Record<ServerPermission, string> = {
  administrator: "Administrador (todos os poderes)", manage_server: "Gerenciar servidor", manage_channels: "Gerenciar canais",
  manage_roles: "Gerenciar cargos", manage_members: "Gerenciar membros", kick_members: "Expulsar membros",
  ban_members: "Banir membros", create_invites: "Criar convites", mention_everyone: "Mencionar @everyone",
  manage_messages: "Gerenciar mensagens", move_members: "Mover membros entre calls",
  disconnect_members: "Desconectar membros da call", view_audit_log: "Ver registro de auditoria",
};

const auditLabels: Record<string, string> = {
  "role.created": "criou um cargo", "role.updated": "alterou um cargo", "role.deleted": "apagou um cargo",
  "role.assigned": "atribuiu um cargo", "role.removed": "removeu um cargo", "member.kicked": "expulsou um membro",
  "member.banned": "baniu um membro", "member.unbanned": "removeu um banimento", "member.joined": "entrou no servidor",
  "voice.disconnect": "desconectou alguem da call", "voice.move": "moveu alguem de call", "channel.insert": "criou um canal",
  "channel.update": "alterou um canal", "channel.delete": "apagou um canal", "invite.insert": "criou um convite",
  "invite.delete": "apagou um convite", "server.update": "alterou o servidor",
};

export function ServerSettingsModal({ server, profile, initialTab = "overview", initialKind = "text", onClose, onChanged, onDeleted }: { server: ServerBundle; profile: Profile; initialTab?: ServerSettingsTab; initialKind?: "text" | "voice"; onClose(): void; onChanged(): Promise<void>; onDeleted(): Promise<void> }) {
  const [tab, setTab] = useState<ServerSettingsTab>(initialTab);
  const [name, setName] = useState(server.name);
  const [iconUrl, setIconUrl] = useState(server.iconUrl ?? "");
  const [channelKind, setChannelKind] = useState<"text" | "voice">(initialKind);
  const [channelName, setChannelName] = useState("");
  const [channelNames, setChannelNames] = useState<Record<string, string>>(() => Object.fromEntries(server.channels.map((channel) => [channel.id, channel.name])));
  const [confirmChannel, setConfirmChannel] = useState<string>();
  const [confirmServer, setConfirmServer] = useState("");
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const manager = canServer(server, "manage_server");
  const canChannels = canServer(server, "manage_channels");
  const canRoles = canServer(server, "manage_roles");
  const canKick = canServer(server, "kick_members");
  const canBan = canServer(server, "ban_members");
  const canAudit = canServer(server, "view_audit_log");
  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  const reloadManagement = useCallback(async () => {
    const [nextRoles, nextMembers] = await Promise.all([loadServerRoles(server.id), loadMembers(server.id)]);
    setRoles(nextRoles); setMembers(nextMembers); setSelectedRoleId((current) => current && nextRoles.some((role) => role.id === current) ? current : nextRoles[0]?.id);
    if (canBan) setBans(await loadBans(server.id));
    if (canAudit) setAudit(await loadAuditLogs(server.id));
  }, [server.id, canBan, canAudit]);

  useEffect(() => { setChannelNames(Object.fromEntries(server.channels.map((channel) => [channel.id, channel.name]))); }, [server.channels]);
  useEffect(() => { void reloadManagement().catch((cause) => setError(cause instanceof Error ? cause.message : "Nao foi possivel carregar as configuracoes")); }, [reloadManagement]);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Operacao indisponivel"); }
    finally { setBusy(false); }
  }

  async function saveOverview(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => { await updateServer(server.id, name, iconUrl); await onChanged(); }, "Servidor atualizado.");
  }

  async function copyInvite() {
    await run(async () => { const link = await createInvite(server.id, profile.id); await window.discord2.clipboard.writeText(link); }, "Link de convite copiado.");
  }

  async function addChannel(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => { await createChannel(server.id, channelName, channelKind, server.channels.length); setChannelName(""); await onChanged(); }, `Canal de ${channelKind === "text" ? "texto" : "voz"} criado.`);
  }

  async function saveChannel(channel: Channel) {
    const nextName = channelNames[channel.id]?.trim(); if (!nextName) return;
    await run(async () => { await updateChannel(channel.id, nextName); await onChanged(); }, "Canal atualizado.");
  }

  async function removeChannel(channel: Channel) {
    if (confirmChannel !== channel.id) { setConfirmChannel(channel.id); return; }
    await run(async () => { await deleteChannel(channel.id); setConfirmChannel(undefined); await onChanged(); }, "Canal excluido.");
  }

  async function removeServer() {
    if (confirmServer !== server.name) { setError("Digite exatamente o nome do servidor para confirmar."); return; }
    await run(async () => { await deleteServer(server.id); await onDeleted(); onClose(); }, "Servidor excluido.");
  }

  async function addRole() {
    await run(async () => { const id = await createServerRole(server.id, `Novo cargo ${roles.length}`, "#8b5cf6", {}); await reloadManagement(); setSelectedRoleId(id); await onChanged(); }, "Cargo criado.");
  }

  function patchRole(patch: Partial<ServerRole>) {
    if (!selectedRoleId) return;
    setRoles((current) => current.map((role) => role.id === selectedRoleId ? { ...role, ...patch } : role));
  }

  async function saveRole() {
    if (!selectedRole) return;
    await run(async () => { await updateServerRole(selectedRole); await reloadManagement(); await onChanged(); }, "Cargo atualizado.");
  }

  async function removeRole() {
    if (!selectedRole || selectedRole.isEveryone) return;
    await run(async () => { await deleteServerRole(selectedRole.id); await reloadManagement(); await onChanged(); }, "Cargo apagado.");
  }

  async function toggleMemberRole(member: ServerMember, role: ServerRole, assigned: boolean) {
    await run(async () => { await setMemberRole(server.id, member.profile.id, role.id, assigned); await reloadManagement(); await onChanged(); }, assigned ? "Cargo atribuido." : "Cargo removido.");
  }

  async function moderate(member: ServerMember, action: "kick" | "ban") {
    const reason = reasons[member.profile.id] ?? "";
    await run(async () => { if (action === "kick") await kickMember(server.id, member.profile.id, reason); else await banMember(server.id, member.profile.id, reason); await reloadManagement(); }, action === "kick" ? "Membro expulso." : "Membro banido.");
  }

  const editableRoles = useMemo(() => roles.filter((role) => !role.isEveryone && role.position < server.highestRolePosition), [roles, server.highestRolePosition]);
  const availableTabs: Array<{ id: ServerSettingsTab; label: string; icon: React.ReactNode; visible: boolean }> = [
    { id: "overview", label: "Visao geral", icon: <Settings />, visible: true },
    { id: "channels", label: "Canais", icon: <Hash />, visible: true },
    { id: "roles", label: "Cargos", icon: <Shield />, visible: canRoles },
    { id: "members", label: "Membros", icon: <Users />, visible: canRoles || canKick || canBan },
    { id: "bans", label: "Banimentos", icon: <Ban />, visible: canBan },
    { id: "audit", label: "Auditoria", icon: <ClipboardList />, visible: canAudit },
  ];

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card server-settings-modal community-settings" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X /></button>
    <aside className="community-tabs"><div className="community-title"><div className="modal-badge"><Settings /></div><span><strong>{server.name}</strong><small>Configuracoes</small></span></div>{availableTabs.filter((item) => item.visible).map((item) => <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</aside>
    <section className="community-content">
      <header><div><h2>{availableTabs.find((item) => item.id === tab)?.label}</h2><p>{server.role === "owner" ? "Proprietario" : server.role === "admin" ? "Administrador" : "Membro"}</p></div></header>
      {tab === "overview" && <div className="server-settings-content">
        {manager ? <form onSubmit={saveOverview}><label>Nome do servidor<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label><label>URL do icone (opcional)<input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} type="url" placeholder="https://..." /></label><button className="primary-button" disabled={busy}><Save /> Salvar servidor</button></form> : <div className="settings-info">Voce nao tem permissao para alterar este servidor.</div>}
        {canServer(server, "create_invites") && <button className="choice-card invite-button" disabled={busy} onClick={() => void copyInvite()}><span><Copy /></span><div><strong>Copiar link de convite</strong><small>Abre a pagina do servidor e o FungoCord automaticamente</small></div></button>}
        {server.role === "owner" && <section className="danger-zone"><h3><Trash2 /> Excluir servidor</h3><p>Esta acao remove canais, mensagens, convites e membros deste servidor.</p><label>Digite {server.name} para confirmar<input value={confirmServer} onChange={(event) => setConfirmServer(event.target.value)} /></label><button className="danger-button" disabled={busy || confirmServer !== server.name} onClick={() => void removeServer()}><Trash2 /> Excluir definitivamente</button></section>}
      </div>}
      {tab === "channels" && <div className="server-settings-content">
        {canChannels && <form className="new-channel-form" onSubmit={addChannel}><div className="settings-grid"><label>Tipo<select value={channelKind} onChange={(event) => setChannelKind(event.target.value as "text" | "voice")}><option value="text">Texto</option><option value="voice">Voz</option></select></label><label>Nome<input value={channelName} onChange={(event) => setChannelName(event.target.value)} minLength={1} maxLength={80} required placeholder={channelKind === "text" ? "novo-canal" : "Sala de voz"} /></label></div><button className="primary-button" disabled={busy || !channelName.trim()}><Plus /> Criar canal</button></form>}
        <div className="channel-settings-list">{server.channels.map((channel) => <div className="channel-setting-row" key={channel.id}>{channel.kind === "voice" ? <Volume2 /> : <Hash />}<input disabled={!canChannels} value={channelNames[channel.id] ?? channel.name} onChange={(event) => setChannelNames((current) => ({ ...current, [channel.id]: event.target.value }))} />{canChannels && <><button title="Salvar canal" disabled={busy} onClick={() => void saveChannel(channel)}><Pencil /></button><button className={confirmChannel === channel.id ? "confirm-delete" : ""} title={confirmChannel === channel.id ? "Clique novamente para confirmar" : "Excluir canal"} disabled={busy} onClick={() => void removeChannel(channel)}><Trash2 />{confirmChannel === channel.id && <span>Confirmar</span>}</button></>}</div>)}</div>
      </div>}
      {tab === "roles" && <div className="roles-layout">
        <aside className="role-list"><button className="primary-button" disabled={busy} onClick={() => void addRole()}><Plus /> Criar cargo</button>{roles.map((role) => <button className={selectedRoleId === role.id ? "active" : ""} key={role.id} onClick={() => setSelectedRoleId(role.id)}><i style={{ background: role.color }} /> <span>{role.name}</span><small>{role.position}</small></button>)}</aside>
        {selectedRole && <div className="role-editor"><div className="role-preview"><i style={{ background: selectedRole.color }} /><strong>{selectedRole.name}</strong>{selectedRole.isEveryone && <small>Cargo base</small>}</div><div className="settings-grid"><label>Nome<input value={selectedRole.name} disabled={selectedRole.isEveryone} onChange={(event) => patchRole({ name: event.target.value })} /></label><label>Cor<div className="role-color-field"><input type="color" value={selectedRole.color} onChange={(event) => patchRole({ color: event.target.value })} /><code>{selectedRole.color}</code></div></label><label>Hierarquia<input type="number" min={selectedRole.isEveryone ? 0 : 1} max={Math.min(server.highestRolePosition - 1, 9999)} disabled={selectedRole.isEveryone} value={selectedRole.position} onChange={(event) => patchRole({ position: Number(event.target.value) })} /></label></div><h3>Permissoes</h3><div className="permissions-grid">{SERVER_PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={selectedRole.permissions[permission] === true} onChange={(event) => patchRole({ permissions: { ...selectedRole.permissions, [permission]: event.target.checked } })} /><span>{permissionLabels[permission]}</span></label>)}</div><div className="role-actions"><button className="primary-button" disabled={busy} onClick={() => void saveRole()}><Save /> Salvar cargo</button>{!selectedRole.isEveryone && <button className="danger-button" disabled={busy} onClick={() => void removeRole()}><Trash2 /> Apagar</button>}</div></div>}
      </div>}
      {tab === "members" && <div className="management-list">{members.map((member) => <article key={member.profile.id}><div className="management-person">{member.profile.avatarUrl ? <img src={member.profile.avatarUrl} alt="" /> : <span>{member.profile.displayName.slice(0, 2).toUpperCase()}</span>}<div><strong>{member.profile.displayName}</strong><small>@{member.profile.username} · {member.role}</small></div>{member.role === "owner" && <Crown />}</div>{canRoles && member.role !== "owner" && <div className="member-role-list">{editableRoles.map((role) => { const assigned = member.roles.some((item) => item.id === role.id); return <label key={role.id}><input type="checkbox" checked={assigned} disabled={busy || member.profile.id === profile.id} onChange={(event) => void toggleMemberRole(member, role, event.target.checked)} /><i style={{ background: role.color }} />{role.name}</label>; })}</div>}{member.role !== "owner" && member.profile.id !== profile.id && (canKick || canBan) && <div className="moderation-row"><input value={reasons[member.profile.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [member.profile.id]: event.target.value }))} placeholder="Motivo (opcional)" maxLength={500} />{canKick && <button disabled={busy} onClick={() => void moderate(member, "kick")}><UserMinus /> Expulsar</button>}{canBan && <button className="danger-button" disabled={busy} onClick={() => void moderate(member, "ban")}><Ban /> Banir</button>}</div>}</article>)}</div>}
      {tab === "bans" && <div className="management-list">{bans.length ? bans.map((ban) => <article key={ban.userId}><div className="management-person">{ban.profile?.avatarUrl ? <img src={ban.profile.avatarUrl} alt="" /> : <span>{ban.profile?.displayName?.slice(0, 2).toUpperCase() ?? "?"}</span>}<div><strong>{ban.profile?.displayName ?? "Usuario"}</strong><small>{ban.reason || "Sem motivo informado"} · {new Date(ban.createdAt).toLocaleString("pt-BR")}</small></div><button disabled={busy} onClick={() => void run(async () => { await unbanMember(server.id, ban.userId); await reloadManagement(); }, "Banimento removido.")}>Remover ban</button></div></article>) : <div className="settings-info">Nenhum usuario banido.</div>}</div>}
      {tab === "audit" && <div className="audit-list">{audit.map((entry) => <article key={entry.id}><div className="audit-symbol"><ClipboardList /></div><div><p><strong>{entry.actor?.displayName ?? "Sistema"}</strong> {auditLabels[entry.action] ?? entry.action}{entry.target && <>: <b>{entry.target.displayName}</b></>}</p>{typeof entry.metadata?.reason === "string" && entry.metadata.reason && <small>Motivo: {entry.metadata.reason}</small>}<time>{new Date(entry.createdAt).toLocaleString("pt-BR")}</time></div></article>)}</div>}
      {error && <div className="form-error">{error}</div>}{notice && <div className="form-success">{notice}</div>}
    </section>
  </div></div>;
}
