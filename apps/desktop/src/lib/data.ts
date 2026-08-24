import type { Channel, Message, Profile, Server } from "@discord2/contracts";
import type { User } from "@supabase/supabase-js";
import { getSupabase, row } from "./supabase";

export type ServerBundle = Server & { role: "owner" | "admin" | "member"; channels: Channel[] };

export async function loadWorkspace(user: User): Promise<{ profile: Profile; servers: ServerBundle[] }> {
  const supabase = await getSupabase();
  const [{ data: profileData, error: profileError }, { data: memberships, error: memberError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("server_members").select("role, server:servers(*, channels(*))").eq("user_id", user.id),
  ]);
  if (profileError) throw profileError;
  if (memberError) throw memberError;
  const servers = (memberships ?? []).flatMap((membership: any) => membership.server ? [{
    ...row<Server>(membership.server), role: membership.role,
    channels: (membership.server.channels ?? []).map((channel: any) => row<Channel>(channel)).sort((a: Channel, b: Channel) => a.position - b.position),
  }] : []);
  return { profile: row<Profile>(profileData), servers };
}

export async function loadMessages(channelId: string): Promise<Message[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("messages").select("*, author:profiles(*)").eq("channel_id", channelId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).reverse().map((message: any) => ({ ...row<Message>(message), author: message.author ? row<Profile>(message.author) : undefined }));
}

export async function sendMessage(channelId: string, authorId: string, body: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("messages").insert({ channel_id: channelId, author_id: authorId, body: body.trim() });
  if (error) throw error;
}

export async function createServer(name: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("create_server", { server_name: name.trim() });
  if (error) throw error;
}

export async function joinServer(code: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("join_server", { invite_code: code.trim() });
  if (error) throw error;
}

export async function createInvite(serverId: string, userId: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("invites").insert({ server_id: serverId, creator_id: userId, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), max_uses: 100 }).select("code").single();
  if (error) throw error;
  return data.code as string;
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

export async function loadMembers(serverId: string): Promise<Array<{ role: string; profile: Profile }>> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("server_members").select("role, user_id, profile:profiles!server_members_user_id_fkey(*)").eq("server_id", serverId);
  if (error) throw error;
  return (data ?? []).flatMap((member: any) => member.profile ? [{ role: member.role, profile: row<Profile>(member.profile) }] : []);
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

export async function loadDirectMessages(conversationId: string): Promise<any[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("direct_messages").select("*, author:profiles(*)").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []).map((message: any) => ({ ...row<any>(message), author: row<Profile>(message.author) }));
}

export async function sendDirectMessage(conversationId: string, authorId: string, body: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("direct_messages").insert({ conversation_id: conversationId, author_id: authorId, body: body.trim() });
  if (error) throw error;
}
