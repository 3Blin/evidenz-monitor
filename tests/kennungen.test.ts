/**
 * Prüft das Erkennen von Kennungen. Die Fälle stammen sämtlich aus den 144
 * echten Inhalten des ersten Betriebs - erfundene Beispiele hätten den
 * UUID-Fehler nicht gefunden.
 */
import { describe, expect, it } from "vitest";
import { gemeinsameKennungen, kennungen } from "../src/lib/kennungen";

describe("kennungen", () => {
  it("findet eine KB-Nummer im Titel", () => {
    expect(kennungen("Urgent: Stuck KB5094126 (2026-06 Security Update) Loop on ASUS M413A"))
      .toContain("KB5094126");
  });

  it("erkennt dieselbe Kennung mit Abstand, Strich oder ohne Trennung", () => {
    expect(kennungen("KB 5094126")).toEqual(kennungen("KB-5094126"));
    expect(kennungen("KB5094126")).toEqual(kennungen("KB-5094126"));
  });

  it("erkennt bewusst keine klein geschriebenen Kennungen", () => {
    // Der Preis für die Genauigkeit: Mit Kleinbuchstaben wäre auch "the 2026"
    // eine Kennung, und alle Beiträge mit dieser Wendung gälten als dieselbe
    // Meldung. Eine verpasste Verknüpfung ist ein Mangel, eine erfundene
    // Verknüpfung eine Falschaussage.
    expect(kennungen("kb5094126")).toEqual([]);
    expect(kennungen("Zum Stand the 2026 liegen Zahlen vor")).toEqual([]);
  });

  it("findet CVE-Nummern und behält den Strich zwischen den Ziffern", () => {
    expect(kennungen("CVE-2026-62835 Azure Portal Information Disclosure Vulnerability"))
      .toContain("CVE2026-62835");
  });

  it("unterscheidet CVE-Nummern, die sich nur in der letzten Stelle unterscheiden", () => {
    const a = kennungen("CVE-2026-6283");
    const b = kennungen("CVE-2026-62835");
    expect(gemeinsameKennungen(a, b)).toEqual([]);
  });

  it("findet Buildnummern", () => {
    expect(kennungen("KB5101594 Windows 11 Insider Beta (25H2) build 26220.8925 - July 20"))
      .toEqual(expect.arrayContaining(["KB5101594", "26220.8925"]));
  });

  it("hält ein Datum in Punktschreibweise nicht für eine Buildnummer", () => {
    expect(kennungen("Stand 2026.07 der Auswertung")).toEqual([]);
  });

  it("hält Bruchstücke einer UUID nicht für eine Kennung", () => {
    // Genau dieser Text verband beim Messen zwei Beiträge über eine
    // zufällige Zeichenfolge.
    const text =
      "Bitte entfernen Sie meine Geräte‑UUID vollständig aus dem Windows " +
      "Insider Program: ACF35976‑45A5‑0B48‑A913‑12C6F1A12083";
    expect(kennungen(text)).toEqual([]);
  });

  it("erkennt UUIDs auch mit gewöhnlichem Bindestrich", () => {
    expect(kennungen("Kennung ACF35976-45A5-0B48-A913-12C6F1A12083 entfernen")).toEqual([]);
  });

  it("wertet Titel und Auszug gemeinsam aus", () => {
    expect(kennungen("Rechner friert ein", "Seit dem Update KB5094126 startet er neu"))
      .toContain("KB5094126");
  });

  it("liefert jede Kennung nur einmal", () => {
    expect(kennungen("KB5094126 und nochmals KB5094126")).toEqual(["KB5094126"]);
  });

  it("liefert bei wiederholtem Aufruf dasselbe Ergebnis", () => {
    // Ein geteilter Ausdruck mit /g merkt sich lastIndex; ohne eigene Instanz
    // je Aufruf wäre das zweite Ergebnis leer.
    const text = "KB5094126 im Titel";
    expect(kennungen(text)).toEqual(kennungen(text));
  });

  it("ignoriert kurze Zahlen aus dem Fließtext", () => {
    expect(kennungen("Top 8: Das beste ferngesteuerte Boot im Test – bis zu 45 km/h")).toEqual([]);
    expect(kennungen("Zeiss baut Herstellung um über 25.000 m² aus")).toEqual([]);
  });

  it("meldet keine Kennung für einen Titel ohne Zahlen", () => {
    expect(kennungen("Has OneDrive gone insane?!")).toEqual([]);
  });
});

describe("gemeinsameKennungen", () => {
  it("findet die Schnittmenge", () => {
    expect(gemeinsameKennungen(["KB5094126", "26220.8925"], ["KB5094126"]))
      .toEqual(["KB5094126"]);
  });

  it("liefert eine leere Liste, wenn nichts geteilt wird", () => {
    expect(gemeinsameKennungen(["KB5094126"], ["KB5101594"])).toEqual([]);
  });
});
