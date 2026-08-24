import type { Channel, Profile } from "@discord2/contracts";
import { Copy, Hash, Pencil, Plus, Save, Settings, Trash2, Users, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createChannel, createInvite, deleteChannel, deleteServer, updateChannel, updateServer, type ServerBundle } from "../lib/data";

export function ServerSettingsModal({ server, profile, initialTab = "overview", initialKind = "text", onClose, onChanged, onDeleted }: { server: ServerBundle; profile: Profile; initialTab?: "overview" | "channels"; initialKind?: "text" | "voice"; onClose(): void; onChanged(): Promise<void>; onDeleted(): Promise<void> }) {
  const [tab, setTab] = useState<"overview" | "channels">(initialTab);
  const [name, setName] = useState(server.name);
  const [iconUrl, setIconUrl] = useState(server.iconUrl ?? "");
  const [channelKind, setChannelKind] = useState<"text" | "voice">(initialKind);
  const [channelName, setChannelName] = useState("");
  const [channelNames, setChannelNames] = useState<Record<string, string>>(() => Object.fromEntries(server.channels.map((channel) => [channel.id, channel.name])));
  const [confirmChannel, setConfirmChannel] = useState<string>();
  const [confirmServer, setConfirmServer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const manager = server.role === "owner" || server.role === "admin";

  useEffect(() => { setChannelNames(Object.fromEntries(server.channels.map((channel) => [channel.id, channel.name]))); }, [server.channels]);

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
    await run(async () => { const code = await createInvite(server.id, profile.id); await window.discord2.clipboard.writeText(code); }, "Convite copiado para a area de transferencia.");
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

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card server-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X /></button><div className="modal-badge"><Settings /></div><h2>Configuracoes do servidor</h2><p>{server.name} · {server.role === "owner" ? "Proprietario" : server.role === "admin" ? "Administrador" : "Membro"}</p>
    <div className="settings-tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><Users /> Visao geral</button><button className={tab === "channels" ? "active" : ""} onClick={() => setTab("channels")}><Hash /> Canais</button></div>
    {tab === "overview" ? <div className="server-settings-content">
      {manager ? <form onSubmit={saveOverview}><label>Nome do servidor<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label><label>URL do icone (opcional)<input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} type="url" placeholder="https://..." /></label><button className="primary-button" disabled={busy}><Save /> Salvar servidor</button></form> : <div className="settings-info">Somente proprietarios e administradores podem alterar este servidor.</div>}
      <button className="choice-card invite-button" disabled={busy} onClick={() => void copyInvite()}><span><Copy /></span><div><strong>Copiar convite</strong><small>Valido por sete dias e ate 100 usos</small></div></button>
      {server.role === "owner" && <section className="danger-zone"><h3><Trash2 /> Excluir servidor</h3><p>Esta acao remove canais, mensagens, convites e membros deste servidor.</p><label>Digite {server.name} para confirmar<input value={confirmServer} onChange={(event) => setConfirmServer(event.target.value)} /></label><button className="danger-button" disabled={busy || confirmServer !== server.name} onClick={() => void removeServer()}><Trash2 /> Excluir definitivamente</button></section>}
    </div> : <div className="server-settings-content">
      {manager && <form className="new-channel-form" onSubmit={addChannel}><div className="settings-grid"><label>Tipo<select value={channelKind} onChange={(event) => setChannelKind(event.target.value as "text" | "voice")}><option value="text">Texto</option><option value="voice">Voz</option></select></label><label>Nome<input value={channelName} onChange={(event) => setChannelName(event.target.value)} minLength={1} maxLength={80} required placeholder={channelKind === "text" ? "novo-canal" : "Sala de voz"} /></label></div><button className="primary-button" disabled={busy || !channelName.trim()}><Plus /> Criar canal</button></form>}
      <div className="channel-settings-list">{server.channels.map((channel) => <div className="channel-setting-row" key={channel.id}>{channel.kind === "voice" ? <Volume2 /> : <Hash />}<input disabled={!manager} value={channelNames[channel.id] ?? channel.name} onChange={(event) => setChannelNames((current) => ({ ...current, [channel.id]: event.target.value }))} />{manager && <><button title="Salvar canal" disabled={busy} onClick={() => void saveChannel(channel)}><Pencil /></button><button className={confirmChannel === channel.id ? "confirm-delete" : ""} title={confirmChannel === channel.id ? "Clique novamente para confirmar" : "Excluir canal"} disabled={busy} onClick={() => void removeChannel(channel)}><Trash2 />{confirmChannel === channel.id && <span>Confirmar</span>}</button></>}</div>)}</div>
    </div>}
    {error && <div className="form-error">{error}</div>}{notice && <div className="form-success">{notice}</div>}
  </div></div>;
}
