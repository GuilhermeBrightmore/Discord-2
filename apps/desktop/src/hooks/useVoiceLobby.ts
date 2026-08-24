import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

export interface VoiceLobbyMember {
  userId: string;
  channelId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  joinedAt: string;
}

export function useVoiceLobby(serverId?: string) {
  const [membersByChannel, setMembersByChannel] = useState<Record<string, VoiceLobbyMember[]>>({});

  useEffect(() => {
    if (!serverId) {
      setMembersByChannel({});
      return;
    }
    let disposed = false;
    let remove: (() => void) | undefined;
    void getSupabase().then((supabase) => {
      if (disposed) return;
      const channel = supabase.channel(`voice-lobby:${serverId}`);
      const sync = () => {
        const seen = new Set<string>();
        const grouped: Record<string, VoiceLobbyMember[]> = {};
        for (const states of Object.values(channel.presenceState())) {
          for (const raw of states) {
            const member = raw as unknown as Partial<VoiceLobbyMember>;
            if (!member.userId || !member.channelId || seen.has(`${member.userId}:${member.channelId}`)) continue;
            seen.add(`${member.userId}:${member.channelId}`);
            const entry: VoiceLobbyMember = {
              userId: member.userId,
              channelId: member.channelId,
              displayName: member.displayName || member.username || "Usuario",
              username: member.username || "usuario",
              avatarUrl: member.avatarUrl ?? null,
              muted: Boolean(member.muted),
              deafened: Boolean(member.deafened),
              joinedAt: member.joinedAt || new Date().toISOString(),
            };
            (grouped[entry.channelId] ??= []).push(entry);
          }
        }
        for (const members of Object.values(grouped)) members.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
        setMembersByChannel(grouped);
      };
      channel.on("presence", { event: "sync" }, sync).on("presence", { event: "join" }, sync).on("presence", { event: "leave" }, sync).subscribe();
      remove = () => { void supabase.removeChannel(channel); };
    });
    return () => {
      disposed = true;
      remove?.();
      setMembersByChannel({});
    };
  }, [serverId]);

  return membersByChannel;
}
