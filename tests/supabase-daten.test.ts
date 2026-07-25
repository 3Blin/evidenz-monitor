import { describe, it, expect, vi, afterEach } from "vitest";
import { ladeDashboardVonSupabase, dashboardSchema } from "../src/lib/supabase-daten";

const gueltig = {
  auftrag: { id: "a", name: "Test", fragestellung: "F?" },
  kennzahlen: { quellen: 7, quellenFehler: 3, inhalte: 144, aussagen: 24, letzterAbruf: "2026-07-24T20:12:15Z" },
  knoten: [{ id: "q1", label: "heise", quellentyp: "fachmedium", gewicht: 25, offiziell: false }],
  kanten: [],
  aussagen: [{ id: "s1", sachverhalt: "X", stufe: 1, ausloeser: "Einzelne Meldung", belegAnzahl: 1, herausgeber: ["heise"], seit: null }],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("Supabase-Datenzugriff", () => {
  it("liefert geprüfte Dashboard-Daten", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(gueltig), { status: 200 })));
    const d = await ladeDashboardVonSupabase("https://x.supabase.co", "k", "a");
    expect(d.kennzahlen.inhalte).toBe(144);
  });

  it("meldet HTTP-Fehler klar (Fehlerfall)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nein", { status: 403 })));
    await expect(ladeDashboardVonSupabase("https://x.supabase.co", "k", "a")).rejects.toThrow(/HTTP 403/);
  });

  it("lehnt unerwarteten Antwortaufbau ab (Schutz vor stillen Fehlern)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ auftrag: {} }), { status: 200 })));
    await expect(ladeDashboardVonSupabase("https://x.supabase.co", "k", "a")).rejects.toThrow(/Aufbau/);
  });

  it("lehnt eine ungültige Reifegrad-Stufe ab", () => {
    const kaputt = { ...gueltig, aussagen: [{ ...gueltig.aussagen[0], stufe: 99 }] };
    expect(dashboardSchema.safeParse(kaputt).success).toBe(false);
  });
});
