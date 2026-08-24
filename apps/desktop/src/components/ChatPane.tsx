import type { Channel, Profile } from "@discord2/contracts";
import type { Message } from "@discord2/contracts";
import { Bell, CornerUpLeft, Hash, Paperclip, Search, SendHorizontal, SmilePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "../hooks/useMessages";
import { loadMembers, sendMessage, type ServerMember } from "../lib/data";
import { loadAppSettings } from "../lib/settings";
import { MessageBody } from "./MessageBody";

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function ChatPane({ channel, profile }: { channel?: Channel; profile: Profile }) {
  const { messages, loading, error } = useMessages(channel?.id);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [replying, setReplying] = useState<Message | null>(null);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { setReplying(null); setBody(""); }, [channel?.id]);
  useEffect(() => {
    if (!channel) return setMembers([]);
    let alive = true;
    void loadMembers(channel.serverId).then((items) => { if (alive) setMembers(items); }).catch(() => undefined);
    return () => { alive = false; };
  }, [channel?.serverId]);
  useEffect(() => {
    const marker = bottom.current;
    if (marker && typeof marker.scrollIntoView === "function") marker.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!channel || !body.trim() || sending) return;
    setSending(true);
    try { setSendError(""); await sendMessage(channel.id, profile.id, body, replying?.id); setBody(""); setReplying(null); }
    catch (cause) { setSendError(cause instanceof Error ? cause.message : "Nao foi possivel enviar a mensagem"); }
    finally { setSending(false); }
  }

  const mentionQuery = body.match(/(?:^|\s)@([a-z0-9_.]*)$/i)?.[1]?.toLowerCase();
  const mentionOptions = useMemo(() => {
    if (mentionQuery === undefined) return [];
    return [
      { id: "everyone", username: "everyone", displayName: "Todos no servidor" },
      ...members.map((member) => ({ id: member.profile.id, username: member.profile.username, displayName: member.profile.displayName })),
    ].filter((item) => item.username.toLowerCase().includes(mentionQuery) || item.displayName.toLowerCase().includes(mentionQuery)).slice(0, 7);
  }, [members, mentionQuery]);

  function insertMention(username: string) {
    setBody((current) => current.replace(/@([a-z0-9_.]*)$/i, `@${username} `));
  }

  if (!channel) return <main className="empty-state"><div className="empty-icon"><Hash /></div><h2>Escolha um canal</h2><p>Selecione um canal de texto para comecar.</p></main>;
  return <main className="chat-pane">
    <header className="topbar"><div className="channel-title"><Hash size={21} /><strong>{channel.name}</strong><span>Converse com a comunidade</span></div><div className="top-actions"><button title="Notificacoes"><Bell size={19} /></button><label className="search-box"><Search size={16} /><input placeholder="Buscar" /></label></div></header>
    <div className="message-list">
      <div className="channel-welcome"><div><Hash size={32} /></div><h2>Bem-vindo a #{channel.name}!</h2><p>Este e o inicio deste canal.</p></div>
      {loading && <div className="notice">Carregando mensagens...</div>}{error && <div className="notice error">{error}</div>}{sendError && <div className="notice error">{sendError}</div>}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const compact = previous?.authorId === message.authorId && Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 300000;
        const isCompact = compact && !message.reply;
        return <article className={`message ${isCompact ? "compact" : ""}`} key={message.id}>
          {!isCompact && <div className="avatar">{message.author?.avatarUrl ? <img src={message.author.avatarUrl} /> : initials(message.author?.displayName ?? "U")}</div>}
          <div className="message-content">{message.reply && <div className="message-reply"><CornerUpLeft /><strong>{message.reply.author?.displayName ?? "Usuario"}</strong><span>{message.reply.body}</span></div>}{!isCompact && <div className="message-meta"><strong>{message.author?.displayName ?? "Usuario"}</strong><time>{new Date(message.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>}<MessageBody body={message.body} me={profile.username} /></div>
          <div className="message-actions"><button title="Responder" onClick={() => setReplying(message)}><CornerUpLeft /></button></div>
        </article>;
      })}<div ref={bottom} />
    </div>
    <div className="composer-shell">
      {replying && <div className="replying-banner"><span>Respondendo a <strong>{replying.author?.displayName ?? "Usuario"}</strong></span><small>{replying.body}</small><button onClick={() => setReplying(null)}><X /></button></div>}
      {mentionOptions.length > 0 && <div className="mention-picker">{mentionOptions.map((item) => <button key={item.id} onMouseDown={(event) => { event.preventDefault(); insertMention(item.username); }}><strong>@{item.username}</strong><span>{item.displayName}</span></button>)}</div>}
      <form className="composer" onSubmit={submit}><button type="button" title="Anexar"><Paperclip size={20} /></button><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && loadAppSettings().sendWithEnter) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Enviar mensagem em #${channel.name}`} rows={1} maxLength={4000} /><button type="button" title="Emoji"><SmilePlus size={20} /></button><button className="send-button" disabled={!body.trim() || sending} title="Enviar"><SendHorizontal size={19} /></button></form>
    </div>
  </main>;
}
