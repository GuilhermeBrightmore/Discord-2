import type { Message } from "@discord2/contracts";
import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { loadMessages } from "../lib/data";

export function useMessages(channelId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!channelId) return setMessages([]);
    try { setLoading(true); setMessages(await loadMessages(channelId)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar mensagens"); }
    finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => {
    void refresh();
    if (!channelId) return;
    let disposed = false;
    let channel: ReturnType<Awaited<ReturnType<typeof getSupabase>>["channel"]> | undefined;
    void getSupabase().then((supabase) => {
      if (disposed) return;
      channel = supabase.channel(`messages:${channelId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => void refresh()).subscribe();
    });
    return () => { disposed = true; if (channel) void getSupabase().then((supabase) => supabase.removeChannel(channel!)); };
  }, [channelId, refresh]);
  return { messages, loading, error, refresh };
}
