import { rtcTokenRequestSchema } from "@discord2/contracts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { AccessToken } from "livekit-server-sdk";
import { originAllowed, readEnv, type ServerEnv } from "./env";
import { bearerToken, createAdminClient } from "./supabase";

type Variables = { userId: string; accessToken: string };

export function makeApp(environment: Record<string, string | undefined> = process.env) {
  const env: ServerEnv = readEnv(environment);
  const admin = createAdminClient(env);
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", logger());
  app.use("*", cors({
    origin: (origin) => originAllowed(origin, env.ALLOWED_ORIGINS) ? origin : "",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }));

  app.get("/", (context) => context.json({ name: "FungoCord API", status: "online" }));
  app.get("/api/health", async (context) => {
    const { error } = await admin.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    return context.json({ ok: !error, service: "fungocord-central", database: error ? "indisponivel" : "online", time: new Date().toISOString() }, error ? 503 : 200);
  });
  app.get("/api/config", (context) => context.json({ livekitUrl: env.PUBLIC_LIVEKIT_URL ?? env.LIVEKIT_URL }));

  app.get("/api/invites/:code", async (context) => {
    const code = context.req.param("code").trim().toLowerCase();
    if (!/^[a-z0-9_-]{4,64}$/.test(code)) return context.json({ error: "Convite invalido" }, 400);
    const { data: invite, error } = await admin
      .from("invites")
      .select("code, expires_at, max_uses, uses, server:servers(id, name, icon_url)")
      .ilike("code", code)
      .maybeSingle();
    const server = invite?.server as unknown as { id: string; name: string; icon_url: string | null } | null;
    const expired = invite?.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
    const exhausted = invite?.max_uses != null && invite.uses >= invite.max_uses;
    if (error || !invite || !server || expired || exhausted) return context.json({ error: "Convite invalido ou expirado" }, 404);
    const { count } = await admin.from("server_members").select("user_id", { head: true, count: "exact" }).eq("server_id", server.id);
    return context.json({
      code: invite.code,
      server: { id: server.id, name: server.name, iconUrl: server.icon_url, memberCount: count ?? 0 },
      expiresAt: invite.expires_at,
    });
  });

  app.use("/api/rtc/*", async (context, next) => {
    const token = bearerToken(context.req.header("Authorization"));
    if (!token) return context.json({ error: "Autenticacao necessaria" }, 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return context.json({ error: "Sessao invalida ou expirada" }, 401);
    context.set("userId", data.user.id);
    context.set("accessToken", token);
    await next();
  });

  app.post("/api/rtc/token", async (context) => {
    const parsed = rtcTokenRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "Canal ou permissao invalida" }, 400);
    const userId = context.get("userId");
    const { data: channel, error: channelError } = await admin.from("channels").select("id, server_id, kind").eq("id", parsed.data.channelId).eq("kind", "voice").maybeSingle();
    if (channelError || !channel) return context.json({ error: "Canal de voz nao encontrado" }, 404);
    const { data: member } = await admin.from("server_members").select("user_id").eq("server_id", channel.server_id).eq("user_id", userId).maybeSingle();
    if (!member) return context.json({ error: "Voce nao participa deste servidor" }, 403);
    const { data: profile } = await admin.from("profiles").select("display_name, avatar_url").eq("id", userId).single();
    const room = `channel:${channel.id}`;
    const grant = { roomJoin: true, room, canPublish: parsed.data.canPublish, canSubscribe: true, canPublishData: true };
    const livekitToken = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: userId,
      name: profile?.display_name ?? "Usuario",
      metadata: JSON.stringify({ avatarUrl: profile?.avatar_url ?? null, channelId: channel.id }),
      ttl: "10m",
    });
    livekitToken.addGrant(grant);
    return context.json({ token: await livekitToken.toJwt(), room, url: env.PUBLIC_LIVEKIT_URL ?? env.LIVEKIT_URL });
  });

  app.notFound((context) => context.json({ error: "Rota nao encontrada" }, 404));
  app.onError((error, context) => {
    console.error(error);
    return context.json({ error: "Erro interno do servidor" }, 500);
  });
  return app;
}
