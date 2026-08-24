import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  LIVEKIT_URL: z.string().min(4),
  LIVEKIT_API_KEY: z.string().min(3),
  LIVEKIT_API_SECRET: z.string().min(6),
  PUBLIC_LIVEKIT_URL: z.string().min(4).optional(),
  ALLOWED_ORIGINS: z.string().default("*"),
  PORT: z.coerce.number().int().positive().default(8787),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuracao invalida ou ausente: ${missing}`);
  }
  return parsed.data;
}

export function originAllowed(origin: string, configured: string): boolean {
  if (configured.trim() === "*") return true;
  return configured.split(",").map((item) => item.trim()).includes(origin);
}
