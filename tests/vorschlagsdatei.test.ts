/**
 * Prüft das Einlesen einer Quellen-Vorschlagsdatei.
 *
 * Die Datei stammt von einem externen Sammler und ist damit fremde Eingabe.
 * Geprüft wird deshalb vor allem, was NICHT durchkommt - eine Quelle bestimmt,
 * was künftig im Dashboard erscheint.
 */
import { describe, expect, it } from "vitest";
import { leseVorschlagsdatei } from "../src/lib/quellen/vorschlagsdatei";

function datei(quellen: unknown[], rest: Record<string, unknown> = {}): string {
  return JSON.stringify({ frage: "Wer folgt nach?", quellen, ...rest });
}

describe("leseVorschlagsdatei", () => {
  it("liest einen vollständigen Eintrag", () => {
    const d = leseVorschlagsdatei(
      datei([
        { url: "https://www.bundesregierung.de/service/rss", titel: "Mitteilungen", herausgeber: "Bundesregierung" },
      ]),
    );
    expect(d.quellen).toHaveLength(1);
    expect(d.quellen[0]?.herausgeber).toBe("Bundesregierung");
    expect(d.quellen[0]?.istFeed).toBe(true);
    expect(d.frage).toBe("Wer folgt nach?");
  });

  it("leitet den Herausgeber aus der Adresse ab, wenn er fehlt", () => {
    const d = leseVorschlagsdatei(datei([{ url: "https://www.tagesschau.de/inland" }]));
    expect(d.quellen[0]?.herausgeber).toBe("tagesschau.de");
    expect(d.quellen[0]?.titel).toContain("tagesschau.de");
  });

  it("erkennt Einzelseiten als solche", () => {
    const d = leseVorschlagsdatei(datei([{ url: "https://example.org/bericht" }]));
    expect(d.quellen[0]?.istFeed).toBe(false);
  });

  it("weist Adressen ab, die nicht http oder https sind", () => {
    // Ein javascript:-Verweis in einer Quellenliste hat keinen Zweck, den man
    // wohlwollend deuten könnte.
    const d = leseVorschlagsdatei(
      datei([
        { url: "https://gut.example/feed" },
        { url: "javascript:alert(1)" },
        { url: "data:text/html,<script>" },
        { url: "file:///etc/passwd" },
      ]),
    );
    expect(d.quellen).toHaveLength(1);
    expect(d.hinweise.join(" ")).toContain("3 Einträge übergangen");
  });

  it("entfernt Wiederholungen", () => {
    const d = leseVorschlagsdatei(
      datei([
        { url: "https://a.example/feed" },
        { url: "https://a.example/feed" },
        { url: "https://a.example/feed#abschnitt" },
      ]),
    );
    expect(d.quellen).toHaveLength(1);
  });

  it("begrenzt die Zahl der Vorschläge und sagt es", () => {
    const viele = Array.from({ length: 60 }, (_, i) => ({ url: `https://a.example/${i}` }));
    const d = leseVorschlagsdatei(datei(viele));
    expect(d.quellen).toHaveLength(50);
    expect(d.hinweise.join(" ")).toContain("ersten 50");
  });

  it("weist unbrauchbares JSON mit einem verständlichen Satz ab", () => {
    expect(() => leseVorschlagsdatei("das ist keine Datei")).toThrow(/kein gültiges JSON/);
  });

  it("weist eine Datei ohne Quellenliste ab", () => {
    expect(() => leseVorschlagsdatei(JSON.stringify({ frage: "x" }))).toThrow(/Aufbau/);
  });

  it("weist eine übergroße Datei ab, statt sie zu verarbeiten", () => {
    const zuViele = Array.from({ length: 500 }, (_, i) => ({ url: `https://a.example/${i}` }));
    expect(() => leseVorschlagsdatei(datei(zuViele))).toThrow(/Aufbau/);
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(leseVorschlagsdatei(datei([])).quellen).toEqual([]);
  });

  it("nimmt die Angabe zum Werkzeug mit", () => {
    const d = leseVorschlagsdatei(datei([], { werkzeug: "notebooklm-py 0.7.3" }));
    expect(d.werkzeug).toBe("notebooklm-py 0.7.3");
  });

  it("kürzt keine Titel stillschweigend auf Unsinn", () => {
    const d = leseVorschlagsdatei(
      datei([{ url: "https://a.example/x", titel: "  Ein Titel mit Leerraum  " }]),
    );
    expect(d.quellen[0]?.titel).toBe("Ein Titel mit Leerraum");
  });
});
