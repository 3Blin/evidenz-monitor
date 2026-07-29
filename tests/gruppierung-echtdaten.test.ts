/**
 * Misst die Gruppierung an den 144 echten Inhalten des ersten Auftrags.
 *
 * Warum als Test und nicht nur als Skript: Die Zahlen hier sind das Ergebnis
 * einer Messung, die zwei Falschverschmelzungen aufgedeckt hat, welche keine
 * Überlegung am Schreibtisch gefunden hatte. Als Test festgehalten, können sie
 * nicht unbemerkt zurückkommen.
 *
 * Die Zusammenführungen sind hier einzeln aufgeführt - nicht nur ihre Anzahl.
 * Eine Zahl allein würde auch dann stimmen, wenn eine richtige Verknüpfung
 * gegen eine falsche getauscht wird.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gruppiereMitBegruendung, type VorInhalt } from "../src/lib/vorklassifikation";

function ladeEchteInhalte(): readonly VorInhalt[] {
  const pfad = join(process.cwd(), "tests", "daten", "echte-inhalte.txt");
  return readFileSync(pfad, "utf8")
    .split("\n")
    .filter((zeile) => zeile.trim() && !zeile.startsWith("#"))
    .map((zeile, i) => {
      const [herausgeber = "", quellentyp = "", datum = "", ...rest] = zeile.split("|");
      return {
        inhaltId: `i${i}`,
        titel: rest.join("|"),
        herausgeber,
        quellentyp,
        veroeffentlichtAm: datum === "-" ? null : new Date(`${datum}T12:00:00Z`),
        auszug: "",
      };
    });
}

const inhalte = ladeEchteInhalte();
const gruppen = gruppiereMitBegruendung(inhalte);
const zusammengefuehrt = gruppen.filter((g) => g.inhalte.length > 1);

describe("Gruppierung an echten Daten", () => {
  it("liest alle 144 Inhalte ein", () => {
    expect(inhalte).toHaveLength(144);
  });

  it("führt genau vier Meldungen zusammen", () => {
    expect(zusammengefuehrt).toHaveLength(4);
  });

  it("führt ausschließlich richtige Meldungen zusammen", () => {
    const beschreibungen = zusammengefuehrt.map((g) => ({
      titel: g.inhalte.map((i) => i.titel).sort(),
      grund: g.begruendung,
    }));

    // Zwei Aggregator-Beiträge mit identischem Titel.
    expect(beschreibungen).toContainEqual({
      titel: [
        "Microsoft responds to LG monitors installing McAfee ads on Windows",
        "Microsoft responds to LG monitors installing McAfee ads on Windows",
      ],
      grund: "Titelähnlichkeit 1.00",
    });

    // Dieselbe Sicherheitslücke, vom Hersteller nachträglich umbenannt.
    expect(beschreibungen).toContainEqual({
      titel: [
        "CVE-2026-62835 Azure Portal Information Disclosure Vulnerability",
        "CVE-2026-62835 Online Services Information Disclosure Vulnerability",
      ],
      grund: "Gemeinsame Kennung CVE2026-62835",
    });

    // Zwei Anläufe desselben Nutzers, fast gleich formuliert.
    expect(beschreibungen).toContainEqual({
      titel: [
        "Bitte Geraete-UUID aus Windows Insider Program entfernen",
        "Bitte Geraete-UUID aus dem Windows Insider Program entfernen",
      ],
      grund: "Titelähnlichkeit 0.89",
    });

    // Der Fall, für den die Kennungen eingeführt wurden: Titelähnlichkeit
    // 0,11, aber unverkennbar dieselbe Update-Schleife.
    expect(beschreibungen).toContainEqual({
      titel: [
        "How to Stop the Win 11 KB5094126 Installation Loop and Safely Upgrade From March Baseline Risk-Free",
        "Urgent: Stuck KB5094126 (2026-06 Security Update) Loop on ASUS M413A",
      ],
      grund: "Gemeinsame Kennung KB5094126",
    });
  });

  it("verschmilzt keine zwei verschiedenen Sicherheitslücken", () => {
    // Vor dieser Regel entstanden hier vier Gruppen aus je zwei bis drei
    // verschiedenen CVE-Nummern, allein wegen der Formelwörter in den Titeln.
    for (const gruppe of zusammengefuehrt) {
      const nummern = new Set(
        gruppe.inhalte
          .map((i) => /CVE-\d{4}-\d+/u.exec(i.titel)?.[0])
          .filter((n): n is string => n !== undefined),
      );
      expect(nummern.size).toBeLessThanOrEqual(1);
    }
  });

  it("hängt nicht von der Reihenfolge der Beiträge ab", () => {
    const umgekehrt = gruppiereMitBegruendung([...inhalte].reverse());
    expect(umgekehrt).toHaveLength(gruppen.length);
    expect(umgekehrt.filter((g) => g.inhalte.length > 1)).toHaveLength(zusammengefuehrt.length);
  });
});
