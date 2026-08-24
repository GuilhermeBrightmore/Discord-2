import type { Channel, Message, Profile, Server } from "@discord2/contracts";
import type { User } from "@supabase/supabase-js";
import { getRuntimeConfig, getSupabase, row } from "./supabase";

export const SERVER_PERMISSIONS = [
  "administrator", "manage_server", "manage_channels", "manage_roles", "manage_members", "kick_members",
  "ban_members", "create_invites", "mention_everyone", "manage_messages", "move_members",
  "disconnect_members", "view_audit_log",
] as const;
export type ServerPermission = typeof SERVER_PERMISSIONS[number];
export interface ServerRole { id: string; serverId: string; name: string; color: string; position: number; permissions: Record<string, boolean>; isEveryone: boolean; createdAt: string }
export type ServerBundle = Server & { role: "owner" | "admin" | "member"; channels: Channel[]; permissions: Record<string, boolean>; highestRolePosition: number };
export interface ServerMember { role: string; profile: Profile; roles: ServerRole[] }
export interface ServerBan { serverId: string; userId: string; moderatorId: string | null; reason: string | null; createdAt: string; profile: Profile; moderator?: Profile | null }
export interface AuditEntry { id: number; serverId: string; actorId: string | null; targetUserId: string | null; action: string; targetType: string | null; targetId: string | null; metadata: Record<string, unknown>; createdAt: string; actor?: Profile | null; target?: Profile | null }
export interface InvitePreview { code: string; server: { id: string; name: string; iconUrl: string | null; memberCount: number }; expiresAt: string | null }

export function canServer(server: ServerBundle, permission: ServerPermission) {
  return server.role === "owner" || server.role === "admin" || server.permissions.administrator === true || server.permissions[permission] === true;
}

export async function loadWorkspace(user: User): Promise<{ profile: Profile; servers: ServerBundle[] }> {
  const supabase = await getSupabase();
  const [{ data: profileData, error: profileError }, { data: memberships, error: memberError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("server_members").select("role, server:servers(*, channels(*))").eq("user_id", user.id),
    supabase.from("member_roles").select("server_id, role:server_roles(*)").eq("user_id", user.id),
  ]);
  if (profileError) throw profileError;
  if (memberError) throw memberError;
  if (assignmentError) throw assignmentError;
  const rolesByServer = new Map<string, ServerRole[]>();
  for (const assignment of assignments ?? []) {
    if (!(assignment as any).role) continue;
    const roles = rolesByServer.get((assignment as any).server_id) ?? [];
    roles.push(row<ServerRole>((assignment as any).role));
    rolesByServer.set((assignment as any).server_id, roles);
  }
  const servers = (memberships ?? []).flatMap((membership: any) => membership.server ? [{
    ...row<Server>(membership.server), role: membership.role,
    channels: (membership.server.channels ?? []).map((channel: any) => row<Channel>(channel)).sort((a: Channel, b: Channel) => a.position - b.position),
    permissions: (rolesByServer.get(membership.server.id) ?? []).reduce((all, role) => ({ ...all, ...role.permissions }), {} as Record<string, boolean>),
    highestRolePosition: membership.role === "owner" ? Number.MAX_SAFE_INTEGER : membership.role === "admin" ? 1_000_000_000 : Math.max(0, ...(rolesByServer.get(membership.server.id) ?? []).map((role) => role.position)),
  }] : []);
  return { profile: row<Profile>(profileData), servers };
}

export async function loadMessages(channelId: string): Promise<Message[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("messages").select("*, author:profiles(*), reply:messages!messages_reply_to_id_fkey(id, body, author:profiles(*))").eq("channel_id", channelId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).reverse().map((message: any) => row<Message>(message));
}

export async function sendMessage(channelId: string, authorId: string, body: string, replyToId?: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("messages").insert({ channel_id: channelId, author_id: authorId, body: body.trim(), reply_to_id: replyToId ?? null });
  if (error) throw error;
}

export async function createServer(name: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("create_server", { server_name: name.trim() });
  if (error) throw error;
}

export async function joinServer(code: string) {
  const supabase = await getSupabase();
  let inviteCode = code.trim();
  try {
    const link = new URL(inviteCode);
    const parts = [link.hostname, ...link.pathname.split("/")].filter(Boolean);
    const inviteIndex = parts.findIndex((part) => part.toLowerCase() === "invite");
    const linkCode = inviteIndex >= 0 ? parts[inviteIndex + 1] : undefined;
    if (linkCode) inviteCode = linkCode;
  } catch { /* o valor ja e um codigo */ }
  const { data, error } = await supabase.rpc("join_server", { invite_code: inviteCode });
  if (error) throw error;
  return data as string;
}

export async function createInvite(serverId: string, userId: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("invites").insert({ server_id: serverId, creator_id: userId, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), max_uses: 100 }).select("code").single();
  if (error) throw error;
  const config = await getRuntimeConfig();
  return new URL(`/invite/${data.code as string}`, config.apiUrl).toString();
}

export async function loadInvitePreview(code: string): Promise<InvitePreview> {
  const config = await getRuntimeConfig();
  const response = await fetch(new URL(`/api/invites/${encodeURIComponent(code)}`, config.apiUrl));
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Convite invalido ou expirado");
  return body as InvitePreview;
}

export async function createChannel(serverId: string, name: string, kind: "text" | "voice", position: number) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("channels").insert({ server_id: serverId, name: name.trim(), kind, position });
  if (error) throw error;
}

export async function updateChannel(channelId: string, name: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("channels").update({ name: name.trim() }).eq("id", channelId);
  if (error) throw error;
}

export async function deleteChannel(channelId: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("channels").delete().eq("id", channelId);
  if (error) throw error;
}

export async function updateServer(serverId: string, name: string, iconUrl: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("servers").update({ name: name.trim(), icon_url: iconUrl.trim() || null }).eq("id", serverId);
  if (error) throw error;
}

export async function deleteServer(serverId: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("servers").delete().eq("id", serverId);
  if (error) throw error;
}

export async function loadMembers(serverId: string): Promise<ServerMember[]> {
  const supabase = await getSupabase();
  const [{ data, error }, { data: assignments, error: roleError }] = await Promise.all([
    supabase.from("server_members").select("role, user_id, profile:profiles!server_members_user_id_fkey(*)").eq("server_id", serverId),
    supabase.from("member_roles").select("user_id, role:server_roles(*)").eq("server_id", serverId),
  ]);
  if (error) throw error;
  if (roleError) throw roleError;
  const roles = new Map<string, ServerRole[]>();
  for (const assignment of assignments ?? []) {
    if (!(assignment as any).role) continue;
    roles.set((assignment as any).user_id, [...(roles.get((assignment as any).user_id) ?? []), row<ServerRole>((assignment as any).role)]);
  }
  return (data ?? []).flatMap((member: any) => member.profile ? [{ role: member.role, profile: row<Profile>(member.profile), roles: roles.get(member.user_id) ?? [] }] : []);
}

export async function loadServerRoles(serverId: string): Promise<ServerRole[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("server_roles").select("*").eq("server_id", serverId).order("position", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => row<ServerRole>(item));
}

export async function createServerRole(serverId: string, name: string, color: string, permissions: Record<string, boolean>) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("create_server_role", { target_server: serverId, role_name: name.trim(), role_color: color, role_permissions: permissions });
  if (error) throw error;
  return data as string;
}

export async function updateServerRole(role: ServerRole) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("update_server_role", { target_role: role.id, role_name: role.name.trim(), role_color: role.color, role_position: role.position, role_permissions: role.permissions });
  if (error) throw error;
}

export async function deleteServerRole(roleId: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("delete_server_role", { target_role: roleId });
  if (error) throw error;
}

export async function setMemberRole(serverId: string, userId: string, roleId: string, assigned: boolean) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc(assigned ? "assign_server_role" : "remove_server_role", { target_server: serverId, target_user: userId, target_role: roleId });
  if (error) throw error;
}

export async function kickMember(serverId: string, userId: string, reason: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("kick_server_member", { target_server: serverId, target_user: userId, reason });
  if (error) throw error;
}

export async function banMember(serverId: string, userId: string, reason: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("ban_server_member", { target_server: serverId, target_user: userId, reason });
  if (error) throw error;
}

export async function loadBans(serverId: string): Promise<ServerBan[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("server_bans").select("*, profile:profiles!server_bans_user_id_fkey(*), moderator:profiles!server_bans_moderator_id_fkey(*)").eq("server_id", serverId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => row<ServerBan>(item));
}

export async function unbanMember(serverId: string, userId: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("unban_server_member", { target_server: serverId, target_user: userId });
  if (error) throw error;
}

export async function loadAuditLogs(serverId: string): Promise<AuditEntry[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("audit_logs").select("*, actor:profiles!audit_logs_actor_id_fkey(*), target:profiles!audit_logs_target_user_id_fkey(*)").eq("server_id", serverId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((item) => row<AuditEntry>(item));
}

export async function issueVoiceCommand(serverId: string, userId: string, action: "disconnect" | "move", channelId?: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("issue_voice_command", { target_server: serverId, target_user: userId, command_action: action, target_channel: channelId ?? null });
  if (error) throw error;
}

export interface DirectConversation { id: string; profile: Profile }

export async function loadConversations(userId: string): Promise<DirectConversation[]> {
  const supabase = await getSupabase();
  const { data: mine, error: mineError } = await supabase.from("direct_members").select("conversation_id").eq("user_id", userId);
  if (mineError) throw mineError;
  const ids = (mine ?? []).map((item: any) => item.conversation_id as string);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("direct_members").select("conversation_id, profile:profiles(*)").in("conversation_id", ids).neq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((item: any) => ({ id: item.conversation_id, profile: row<Profile>(item.profile) }));
}

export async function searchProfiles(term: string, userId: string): Promise<Profile[]> {
  const supabase = await getSupabase();
  const clean = term.replace(/[%_,]/g, "");
  const { data, error } = await supabase.from("profiles").select("*").or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`).neq("id", userId).limit(12);
  if (error) throw error;
  return (data ?? []).map((item: any) => row<Profile>(item));
}

export async function openDirect(otherUser: string): Promise<string> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("open_direct", { other_user: otherUser });
  if (error) throw error;
  return data as string;
}

export interface DirectMessage { id: string; conversationId: string; authorId: string; body: string; createdAt: string; replyToId?: string | null; author: Profile; reply?: { id: string; body: string; author?: Profile } | null }

export async function loadDirectMessages(conversationId: string): Promise<DirectMessage[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("direct_messages").select("*, author:profiles(*), reply:direct_messages!direct_messages_reply_to_id_fkey(id, body, author:profiles(*))").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []).map((message) => row<DirectMessage>(message));
}

export async function sendDirectMessage(conversationId: string, authorId: string, body: string, replyToId?: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("direct_messages").insert({ conversation_id: conversationId, author_id: authorId, body: body.trim(), reply_to_id: replyToId ?? null });
  if (error) throw error;
}
