import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;
let runtimeConfig: RuntimeConfig | null = null;

export async function getRuntimeConfig() {
  if (runtimeConfig) return runtimeConfig;
  const electronConfig = window.discord2 ? await window.discord2.config() : {};
  runtimeConfig = {
    supabaseUrl: electronConfig.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: electronConfig.supabaseKey ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    apiUrl: electronConfig.apiUrl ?? import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787",
    livekitUrl: electronConfig.livekitUrl ?? import.meta.env.VITE_LIVEKIT_URL,
  };
  return runtimeConfig;
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) clientPromise = (async () => {
    const config = await getRuntimeConfig();
    if (!config.supabaseUrl || !config.supabaseKey) throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
    const client = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
    const serialized = await window.discord2?.session.load();
    if (serialized) {
      try {
        const session = JSON.parse(serialized) as Session;
        await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      } catch { await window.discord2?.session.clear(); }
    }
    client.auth.onAuthStateChange((_event, session) => {
      if (session) void window.discord2?.session.save(JSON.stringify(session));
      else void window.discord2?.session.clear();
    });
    return client;
  })();
  return clientPromise;
}

export function row<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => row(item)) as T;
  if (!value || typeof value !== "object") return value as T;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), row(item)])) as T;
}
