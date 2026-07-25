import { describe, it, expect } from "vitest";
import { ladeWebKonfiguration } from "../src/lib/konfig";

const gueltig = {
  NEXT_PUBLIC_SUPABASE_URL: "https://beispiel.supabase.co",
  NEXT_PUBLIC_SUPABASE_KEY: "sb_publishable_abcdefghijkl",
  NEXT_PUBLIC_AUFTRAG: "db0ec997-7fa1-4cb7-8e5d-3124446e1f60",
};

describe("Web-Konfiguration", () => {
  it("übernimmt vollständige Werte", () => {
    const k = ladeWebKonfiguration(gueltig);
    expect(k.supabaseUrl).toContain("supabase.co");
    expect(k.auftragId).toHaveLength(36);
  });

  it("bricht bei fehlender Adresse ab (Fehlerfall)", () => {
    expect(() => ladeWebKonfiguration({ ...gueltig, NEXT_PUBLIC_SUPABASE_URL: undefined }))
      .toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("bricht bei fehlendem Schlüssel ab (Fehlerfall)", () => {
    expect(() => ladeWebKonfiguration({ ...gueltig, NEXT_PUBLIC_SUPABASE_KEY: "" }))
      .toThrow(/NEXT_PUBLIC_SUPABASE_KEY/);
  });

  it("lehnt eine Auftragskennung ab, die keine UUID ist (Fehlerfall)", () => {
    expect(() => ladeWebKonfiguration({ ...gueltig, NEXT_PUBLIC_AUFTRAG: "irgendwas" }))
      .toThrow(/UUID/);
  });
});
