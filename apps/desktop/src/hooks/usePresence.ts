import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

export function usePresence(serverId: string | undefined, userId: string) {
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!serverId) return;
    let disposed = false;
    let presenceChannel: any;
    void getSupabase().then((supabase) => {
      if (disposed) return;
      presenceChannel = supabase.channel(`presence:${serverId}`, { config: { presence: { key: userId } } })
        .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(presenceChannel.presenceState()))))
        .subscribe(async (status) => { if (status === "SUBSCRIBED") await presenceChannel.track({ userId, onlineAt: new Date().toISOString() }); });
    });
    return () => { disposed = true; if (presenceChannel) void getSupabase().then((supabase) => supabase.removeChannel(presenceChannel)); };
  }, [serverId, userId]);
  return online;
}
