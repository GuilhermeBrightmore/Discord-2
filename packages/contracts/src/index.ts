import { z } from "zod";

export const channelKindSchema = z.enum(["text", "voice"]);
export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
export const profileSchema = z.object({ id: z.string().uuid(), username: z.string().min(2).max(32), displayName: z.string().min(1).max(64), avatarUrl: z.string().url().nullable(), status: z.enum(["online", "idle", "dnd", "offline"]) });
export const serverSchema = z.object({ id: z.string().uuid(), name: z.string().min(2).max(80), iconUrl: z.string().url().nullable(), ownerId: z.string().uuid(), createdAt: z.string() });
export const channelSchema = z.object({ id: z.string().uuid(), serverId: z.string().uuid(), name: z.string().min(1).max(80), kind: channelKindSchema, position: z.number().int().nonnegative() });
export const messageSchema = z.object({ id: z.string().uuid(), channelId: z.string().uuid(), authorId: z.string().uuid(), body: z.string().min(1).max(4000), createdAt: z.string(), editedAt: z.string().nullable(), author: profileSchema.optional() });
export const rtcTokenRequestSchema = z.object({ channelId: z.string().uuid(), canPublish: z.boolean().default(true) });
export const screenSharePresetSchema = z.object({ resolution: z.enum(["480p", "720p", "1080p", "1440p", "source"]), fps: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]), shareAudio: z.boolean(), preview: z.boolean() });

export type Profile = z.infer<typeof profileSchema>;
export type Server = z.infer<typeof serverSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ScreenSharePreset = z.infer<typeof screenSharePresetSchema>;
export interface BootstrapPayload { profile: Profile; servers: Array<Server & { channels: Channel[]; role: z.infer<typeof memberRoleSchema> }> }
export interface ApiError { error: string; code?: string }
export const normalizeRow = <T extends Record<string, unknown>>(row: T) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
