import { describe, expect, it } from "vitest";
import { makeApp } from "./app";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "devkey",
  LIVEKIT_API_SECRET: "secret-test",
  PUBLIC_LIVEKIT_URL: "wss://example.livekit.cloud",
  ALLOWED_ORIGINS: "*",
  PORT: "8787",
};

describe("API", () => {
  it("responde sem estado na raiz", async () => {
    const response = await makeApp(env).request("/");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ name: "FungoCord API", status: "online" });
  });

  it("protege a emissao de token RTC", async () => {
    const response = await makeApp(env).request("/api/rtc/token", { method: "POST", body: "{}" });
    expect(response.status).toBe(401);
  });

  it("rejeita codigo de convite malformado sem consultar dados", async () => {
    const response = await makeApp(env).request("/api/invites/!");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Convite invalido" });
  });
});
