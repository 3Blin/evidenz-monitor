/**
 * Prüft die Relevanzregeln (ADR 0008).
 *
 * Der Anlass steht als erster Test drin: Ein Artikel über eine Lücke in der
 * redis-Datenbank war im Windows-Auftrag gelandet, weil im Auszug das Wort
 * "Updates" stand. Solange dieser Test grün ist, kann derselbe Fehler nicht
 * unbemerkt zurückkommen.
 */
import { describe, it, expect } from "vitest";
import { pruefeRelevanz, begriffKommtVor, type RelevanzRegeln } from "../src/lib/relevanz";

/** Die Begriffe des ersten Auftrags, wie sie im Seed stehen. */
const WINDOWS_AUFTRAG: RelevanzRegeln = {
  pflichtbegriffe: ["Windows"],
  suchbegriffe: ["Windows 11", "25H2", "Update", "KB", "Treiber", "Bluescreen"],
  ausschlussbegriffe: [],
  mindestTreffer: 1,
};

describe("Relevanzprüfung", () => {
  it("sortiert den Artikel aus, der es auf die Plattform geschafft hatte", () => {
    const befund = pruefeRelevanz(
      "Kimi K3: Chinesische KI findet mehrere Zero-Day-Lücken in redis-Datenbank",
      "Ein IT-Forscher hat mit der chinesischen KI Kimi K3 mehrere Zero-Day-Lücken in der redis-Datenbank entdeckt. Updates bestätigen die Funde.",
      WINDOWS_AUFTRAG,
    );
    expect(befund.relevant).toBe(false);
    expect(befund.begruendung).toContain("Pflichtbegriff fehlt");
  });

  it("lässt eine echte Windows-Meldung durch", () => {
    const befund = pruefeRelevanz(
      "Windows 11 25H2: Bluescreen nach Update KB5000001",
      "Nutzer berichten von Abstürzen mit einem Treiber nach dem Update.",
      WINDOWS_AUFTRAG,
    );
    expect(befund.relevant).toBe(true);
    expect(befund.treffer).toContain("Windows 11");
    expect(befund.treffer).toContain("KB");
  });

  it("begründet jede Entscheidung nachvollziehbar", () => {
    const ja = pruefeRelevanz("Windows Update", "Text", WINDOWS_AUFTRAG);
    expect(ja.begruendung).toMatch(/Suchbegriffe getroffen/);
    const nein = pruefeRelevanz("Etwas anderes", "Text", WINDOWS_AUFTRAG);
    expect(nein.begruendung.length).toBeGreaterThan(0);
  });
});

describe("Themenspezifische Quellen", () => {
  // Beide Fälle stammen aus dem echten Betrieb: Beiträge aus einem reinen
  // Windows-Forum, die das Wort "Windows" nicht enthalten. Ein harter
  // Pflichtbegriff hätte gerade die Frühwarnkanäle beschnitten.
  it("nimmt einen Forenbeitrag an, der das Thema nicht ausschreibt", () => {
    const ausForum = pruefeRelevanz(
      "CrossDeviceResume has reappeared after the Insider Preview update KB5089573",
      "Seit dem letzten Insider-Build ist die Funktion wieder da.",
      WINDOWS_AUFTRAG,
      true,
    );
    expect(ausForum.relevant).toBe(true);
    expect(ausForum.begruendung).toContain("Thema durch die Quelle belegt");
  });

  it("hält denselben Beitrag aus einer breiten Quelle zurück", () => {
    const ausFachmedium = pruefeRelevanz(
      "CrossDeviceResume has reappeared after the Insider Preview update KB5089573",
      "Seit dem letzten Insider-Build ist die Funktion wieder da.",
      WINDOWS_AUFTRAG,
      false,
    );
    expect(ausFachmedium.relevant).toBe(false);
  });

  it("hebelt Ausschlussbegriffe nicht aus", () => {
    const befund = pruefeRelevanz(
      "Update verfügbar",
      "Dies ist ein bezahlter Beitrag (Anzeige).",
      { ...WINDOWS_AUFTRAG, ausschlussbegriffe: ["Anzeige"] },
      true,
    );
    expect(befund.relevant).toBe(false);
  });

  it("hebelt die nötige Trefferzahl nicht aus", () => {
    const befund = pruefeRelevanz(
      "Show HN: Ein Werkzeug für Nvidias LLM-Schnittstelle",
      "Nichts vom Thema des Auftrags.",
      WINDOWS_AUFTRAG,
      true,
    );
    expect(befund.relevant).toBe(false);
    expect(befund.begruendung).toContain("Kein Suchbegriff getroffen");
  });
});

describe("Treffer am Wortanfang", () => {
  it("findet die Kennungen der Herstellerartikel", () => {
    // "KB" soll KB5000001 finden - deshalb ist der Treffer am Wortende erlaubt.
    expect(begriffKommtVor("Behoben in KB5000001", "KB")).toBe(true);
    expect(begriffKommtVor("Mehrere Updates verfügbar", "Update")).toBe(true);
  });

  it("trifft nicht mitten im Wort", () => {
    // Genau der zweite Fehler der ersten Fassung.
    expect(begriffKommtVor("Die Datei liegt in SKBackup", "KB")).toBe(false);
    expect(begriffKommtVor("Ein Nachbarupdate", "Update")).toBe(false);
  });

  it("arbeitet unabhängig von Groß- und Kleinschreibung", () => {
    expect(begriffKommtVor("bluescreen beim Start", "Bluescreen")).toBe(true);
    expect(begriffKommtVor("WINDOWS 11", "Windows 11")).toBe(true);
  });

  it("verkraftet abweichenden Leerraum in Mehrwortbegriffen", () => {
    expect(begriffKommtVor("Windows   11 startet neu", "Windows 11")).toBe(true);
    expect(begriffKommtVor("Windows\n11 startet neu", "Windows 11")).toBe(true);
  });

  it("kommt mit Umlauten am Wortanfang zurecht", () => {
    expect(begriffKommtVor("Überlastung des Dienstes", "Überlastung")).toBe(true);
    expect(begriffKommtVor("Preisüberwachung läuft", "Überwachung")).toBe(false);
  });

  it("behandelt Sonderzeichen als Text, nicht als Suchmuster", () => {
    expect(begriffKommtVor("Version 1.2.3 erschienen", "1.2.3")).toBe(true);
    expect(begriffKommtVor("Version 1x2x3 erschienen", "1.2.3")).toBe(false);
    expect(begriffKommtVor("C++ Compiler", "C++")).toBe(true);
  });

  it("ignoriert leere Begriffe (Fehlerfall)", () => {
    expect(begriffKommtVor("Beliebiger Text", "")).toBe(false);
    expect(begriffKommtVor("Beliebiger Text", "   ")).toBe(false);
  });
});

describe("Mindestzahl an Treffern", () => {
  const regeln: RelevanzRegeln = {
    pflichtbegriffe: [],
    suchbegriffe: ["Preis", "Ferienhaus", "Nordsee"],
    ausschlussbegriffe: [],
    mindestTreffer: 2,
  };

  it("lässt einen einzelnen allgemeinen Begriff nicht genügen", () => {
    const befund = pruefeRelevanz("Preise steigen überall", "Text", regeln);
    expect(befund.relevant).toBe(false);
    expect(befund.begruendung).toContain("Nur 1 von 2");
  });

  it("nimmt einen Inhalt mit zwei verschiedenen Treffern an", () => {
    const befund = pruefeRelevanz("Ferienhaus an der Nordsee", "Text", regeln);
    expect(befund.relevant).toBe(true);
    expect(befund.treffer).toHaveLength(2);
  });

  it("zählt denselben Begriff nicht doppelt", () => {
    const befund = pruefeRelevanz("Preis, Preis, Preis", "Preis", regeln);
    expect(befund.relevant).toBe(false);
    expect(befund.treffer).toEqual(["Preis"]);
  });

  it("behandelt eine Mindestzahl unter 1 wie 1 (Fehlerfall)", () => {
    const befund = pruefeRelevanz("Preise steigen", "Text", { ...regeln, mindestTreffer: 0 });
    expect(befund.relevant).toBe(true);
  });
});

describe("Ausschlussbegriffe", () => {
  it("wiegen schwerer als jeder Treffer", () => {
    const befund = pruefeRelevanz(
      "Windows 11 25H2 Bluescreen nach Update KB5000001",
      "Dies ist ein bezahlter Beitrag (Anzeige).",
      { ...WINDOWS_AUFTRAG, ausschlussbegriffe: ["Anzeige"] },
    );
    expect(befund.relevant).toBe(false);
    expect(befund.begruendung).toContain("Ausschlussbegriff");
  });
});

describe("Aufträge ohne Suchbegriffe", () => {
  it("werden allein über die Pflichtbegriffe gesteuert", () => {
    const regeln: RelevanzRegeln = {
      pflichtbegriffe: ["Hochwasser"],
      suchbegriffe: [],
      ausschlussbegriffe: [],
      mindestTreffer: 1,
    };
    expect(pruefeRelevanz("Hochwasser an der Ahr", "Text", regeln).relevant).toBe(true);
    expect(pruefeRelevanz("Sonnenschein", "Text", regeln).relevant).toBe(false);
  });

  it("lassen ohne jede Angabe alles durch - und sagen das auch", () => {
    const befund = pruefeRelevanz("Irgendwas", "Text", {
      pflichtbegriffe: [], suchbegriffe: [], ausschlussbegriffe: [], mindestTreffer: 1,
    });
    expect(befund.relevant).toBe(true);
    expect(befund.begruendung).toContain("Keine Einschränkung");
  });
});
