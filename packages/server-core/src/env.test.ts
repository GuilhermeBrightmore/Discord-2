import { describe, expect, it } from "vitest";
import { originAllowed } from "./env";

describe("CORS", () => {
  it("aceita lista explicita", () => expect(originAllowed("app://discord2", "https://site.test, app://discord2")).toBe(true));
  it("rejeita origem desconhecida", () => expect(originAllowed("https://evil.test", "app://discord2")).toBe(false));
});
