import type { Profile } from "@discord2/contracts";
import { CornerUpLeft, LogOut, MessageSquarePlus, Search, SendHorizontal, Settings, UserRoundPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { loadDirectMessages, openDirect, searchProfiles, sendDirectMessage, type DirectConversation, type DirectMessage } from "../lib/data";
import { loadAppSettings } from "../lib/settings";
import { MessageBody } from "./MessageBody";

export function DirectSidebar({ profile, conversations, activeId, onOpen, onRefresh, onSettings, onLogout }: { profile: Profile; conversations: DirectConversation[]; activeId?: string; onOpen(id: string): void; onRefresh(): Promise<void>; onSettings(): void; onLogout(): void }) {
  const [searching, setSearching] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  useEffect(() => { const timer = setTimeout(() => { if (term.trim().length >= 2) void searchProfiles(term, profile.id).then(setResults); else setResults([]); }, 250); return () => clearTimeout(timer); }, [term, profile.id]);
  async function start(other: Profile) { const id = await openDirect(other.id); await onRefresh(); onOpen(id); setSearching(false); setTerm(""); }
  return <aside className="channel-sidebar"><header className="dm-header"><strong>Mensagens</strong><button title="Nova conversa" onClick={() => setSearching(!searching)}><MessageSquarePlus /></button></header>{searching && <div className="people-search"><label><Search /><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar pessoa" /></label>{results.map((item) => <button key={item.id} onClick={() => void start(item)}><Avatar profile={item} /><span><strong>{item.displayName}</strong><small>@{item.username}</small></span><UserRoundPlus /></button>)}</div>}<div className="dm-list"><div className="section-label">CONVERSAS DIRETAS</div>{conversations.length ? conversations.map((conversation) => <button className={activeId === conversation.id ? "active" : ""} onClick={() => onOpen(conversation.id)} key={conversation.id}><Avatar profile={conversation.profile} /><span>{conversation.profile.displayName}</span></button>) : <div className="sidebar-hint">Busque alguem para iniciar uma conversa.</div>}</div><UserBar profile={profile} onSettings={onSettings} onLogout={onLogout} /></aside>;
}

export function DirectChat({ conversation, me }: { conversation?: DirectConversation; me: Profile }) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [replying, setReplying] = useState<DirectMessage | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      setReplying(null);
      return;
    }
    let channel: any; let disposed = false;
    const load = () => loadDirectMessages(conversation.id).then((items) => { if (!disposed) { setMessages(items); setError(""); } }).catch((cause) => { if (!disposed) setError(cause instanceof Error ? cause.message : "Falha ao carregar mensagens"); });
    void load();
    void getSupabase().then((supabase) => { channel = supabase.channel(`dm:${conversation.id}`).on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversation.id}` }, load).subscribe(); });
    return () => { disposed = true; if (channel) void getSupabase().then((supabase) => supabase.removeChannel(channel)); };
  }, [conversation?.id]);
  useEffect(() => {
    const marker = bottom.current;
    if (marker && typeof marker.scrollIntoView === "function") marker.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);
  if (!conversation) return <main className="empty-state"><div className="empty-icon"><MessageSquarePlus /></div><h2>Mensagens diretas</h2><p>Escolha uma conversa ou encontre uma pessoa.</p></main>;
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!body.trim() || sending) return; setSending(true); setError(""); try { await sendDirectMessage(conversation!.id, me.id, body, replying?.id); setBody(""); setReplying(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Nao foi possivel enviar"); } finally { setSending(false); } }
  return <main className="chat-pane"><header className="topbar"><div className="channel-title"><Avatar profile={conversation.profile} /><strong>{conversation.profile.displayName}</strong><span>@{conversation.profile.username}</span></div></header><div className="message-list"><div className="channel-welcome"><Avatar profile={conversation.profile} /><h2>{conversation.profile.displayName}</h2><p>Este e o inicio da conversa com @{conversation.profile.username}.</p></div>{error && <div className="notice error">{error}</div>}{messages.map((message) => <article className="message" key={message.id}><Avatar profile={message.author} /><div className="message-content">{message.reply && <div className="message-reply"><CornerUpLeft /><strong>{message.reply.author?.displayName ?? "Usuario"}</strong><span>{message.reply.body}</span></div>}<div className="message-meta"><strong>{message.author?.displayName ?? "Usuario"}</strong><time>{new Date(message.createdAt).toLocaleString("pt-BR")}</time></div><MessageBody body={message.body} me={me.username} /></div><div className="message-actions"><button title="Responder" onClick={() => setReplying(message)}><CornerUpLeft /></button></div></article>)}<div ref={bottom} /></div><div className="composer-shell">{replying && <div className="replying-banner"><span>Respondendo a <strong>{replying.author?.displayName ?? "Usuario"}</strong></span><small>{replying.body}</small><button onClick={() => setReplying(null)}><X /></button></div>}<form className="composer" onSubmit={submit}><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && loadAppSettings().sendWithEnter) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Mensagem para @${conversation.profile.username}`} /><button className="send-button" disabled={!body.trim() || sending}><SendHorizontal /></button></form></div></main>;
}

export function Avatar({ profile }: { profile?: Profile | null }) { const displayName = profile?.displayName || "Usuario"; return <div className="avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} /> : displayName.slice(0, 2).toUpperCase()}</div>; }
export function UserBar({ profile, onSettings, onLogout }: { profile: Profile; onSettings?: () => void; onLogout?: () => void }) { return <div className="user-bar"><Avatar profile={profile} /><div><strong>{profile.displayName}</strong><small>@{profile.username}</small></div><div className="user-actions">{onSettings && <button title="Configuracoes" onClick={onSettings}><Settings /></button>}{onLogout && <button title="Sair" onClick={onLogout}><LogOut /></button>}</div><span className="online-dot" /></div>; }
