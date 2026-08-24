import { describe, expect, it } from "vitest";
import { normalizeRow, screenSharePresetSchema } from "./index";

describe("contratos compartilhados", () => {
  it("normaliza chaves do banco", () => expect(normalizeRow({ display_name: "Guilherme", avatar_url: null })).toEqual({ displayName: "Guilherme", avatarUrl: null }));
  it("aceita presets de tela", () => expect(screenSharePresetSchema.parse({ resolution: "1440p", fps: 60, shareAudio: true, preview: false })).toBeTruthy());
});
