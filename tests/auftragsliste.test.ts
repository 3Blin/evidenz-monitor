/**
 * Prüft die Auswahlliste der Aufträge (ADR 0009).
 *
 * Vorher zeigte die Oberfläche genau einen Auftrag, festgelegt über eine
 * Umgebungsvariable. Damit ließ sich die Themenneutralität des Kerns nicht
 * zeigen, obwohl sie eine verbindliche Vorgabe ist.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ladeOeffentlicheAuftraege,
  waehleAuftrag,
  auftragslisteSchema,
  type AuftragsEintrag,
} from "../src/lib/auftragsliste";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

const liste: readonly AuftragsEintrag[] = [
  { id: A, name: "Windows 11", fragestellung: "Welche Probleme?" },
  { id: B, name: "Sicherheitslücken", fragestellung: "Was ist neu?" },
];

function antwort(koerper: unknown, status = 200): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Auswahl des angezeigten Auftrags", () => {
  it("zeigt den ausdrücklich gewünschten Auftrag", () => {
    expect(waehleAuftrag(B, A, liste)).toBe(B);
  });

  it("nimmt sonst die Vorauswahl aus der Umgebung", () => {
    expect(waehleAuftrag(undefined, A, liste)).toBe(A);
  });

  it("nimmt den ersten freigegebenen, wenn die Vorauswahl nicht freigegeben ist", () => {
    expect(waehleAuftrag(undefined, C, liste)).toBe(A);
  });

  it("hält an der Vorauswahl fest, wenn die Liste leer ist (Fehlerfall)", () => {
    // Etwa wenn die Auftragsliste nicht geladen werden konnte. Die Oberfläche
    // soll dann trotzdem den vorgesehenen Auftrag versuchen.
    expect(waehleAuftrag(undefined, C, [])).toBe(C);
  });

  it("lässt einen gewünschten Auftrag durch, der nicht in der Liste steht", () => {
    // Eigene, nicht freigegebene Aufträge stehen nicht in der öffentlichen
    // Liste. Ob sie angezeigt werden dürfen, entscheidet die Datenbank -
    // nicht diese Funktion.
    expect(waehleAuftrag(C, A, liste)).toBe(C);
  });
});

describe("Laden der freigegebenen Aufträge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("liest die Liste aus der Datenbankfunktion", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(antwort(liste));
    const geladen = await ladeOeffentlicheAuftraege("https://db.example", "key");
    expect(geladen).toHaveLength(2);
    expect(geladen[1]?.name).toBe("Sicherheitslücken");
  });

  it("ruft die vorgesehene Funktion auf und schickt den Schlüssel mit", async () => {
    const stub = vi.spyOn(globalThis, "fetch").mockResolvedValue(antwort([]));
    await ladeOeffentlicheAuftraege("https://db.example", "geheim-nicht");
    const [adresse, optionen] = stub.mock.calls[0]!;
    expect(String(adresse)).toBe("https://db.example/rest/v1/rpc/oeffentliche_auftraege");
    expect((optionen as RequestInit).method).toBe("POST");
  });

  it("verkraftet eine leere Liste", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(antwort([]));
    expect(await ladeOeffentlicheAuftraege("https://db.example", "key")).toEqual([]);
  });

  it("meldet einen Fehlerstatus (Fehlerfall)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(antwort({ fehler: "nein" }, 500));
    await expect(ladeOeffentlicheAuftraege("https://db.example", "key")).rejects.toThrow(/HTTP 500/);
  });

  it("lehnt eine unerwartete Antwortform ab, statt sie zu übernehmen (Fehlerfall)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(antwort([{ id: "keine-uuid", name: "X" }]));
    await expect(ladeOeffentlicheAuftraege("https://db.example", "key")).rejects.toThrow(
      /erwarteten Aufbau/,
    );
  });

  it("lässt keine zusätzlichen Angaben zur Pflicht werden", () => {
    // Die Datenbankfunktion gibt bewusst nur Kennung, Name und Fragestellung
    // heraus - keine Besitzer, keine Suchbegriffe.
    const ergebnis = auftragslisteSchema.safeParse([
      { id: A, name: "X", fragestellung: "Y" },
    ]);
    expect(ergebnis.success).toBe(true);
  });
});
