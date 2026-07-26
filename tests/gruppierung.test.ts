/**
 * Prüft das Zusammenführen von Beiträgen zu Meldungen.
 *
 * Anlass: Im ersten Betrieb entstanden aus 24 Beiträgen 24 Gruppen mit je
 * einem Beitrag. Damit gab es keine einzige Verknüpfung im Quellennetz und
 * jede Aussage blieb auf Stufe 1 stehen - die Kernfunktion des Reifegrads
 * lief leer.
 */
import { describe, expect, it } from "vitest";
import { gruppiere, gruppiereMitBegruendung, type VorInhalt } from "../src/lib/vorklassifikation";

function inhalt(
  inhaltId: string,
  titel: string,
  herausgeber = "Quelle A",
  auszug = "",
): VorInhalt {
  return { inhaltId, titel, herausgeber, quellentyp: "forum", veroeffentlichtAm: null, auszug };
}

describe("gruppiere", () => {
  it("führt Beiträge mit gemeinsamer Kennung zusammen, auch bei fremden Titeln", () => {
    // Beide Beiträge stammen aus dem echten Betrieb und behandeln dieselbe
    // Update-Schleife. Ihre Titelähnlichkeit liegt bei 0,11 - die alte Regel
    // ließ sie deshalb getrennt.
    const gruppen = gruppiere([
      inhalt("1", "How to Stop the Win 11 KB5094126 Installation Loop and Safely Upgrade"),
      inhalt("2", "Urgent: Stuck KB5094126 (2026-06 Security Update) Loop on ASUS M413A"),
    ]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]).toHaveLength(2);
  });

  it("nennt die Kennung als Grund", () => {
    const [gruppe] = gruppiereMitBegruendung([
      inhalt("1", "Stuck KB5094126 Loop"),
      inhalt("2", "Fix für die Schleife", "Quelle B", "Betrifft KB5094126"),
    ]);
    expect(gruppe?.begruendung).toBe("Gemeinsame Kennung KB5094126");
  });

  it("findet die Kennung auch, wenn sie nur im Auszug steht", () => {
    const gruppen = gruppiere([
      inhalt("1", "Rechner startet neu", "Quelle A", "Seit KB5094126 dauernd Neustarts"),
      inhalt("2", "Neustartschleife", "Quelle B", "Nach Installation von KB5094126"),
    ]);
    expect(gruppen).toHaveLength(1);
  });

  it("trennt Sicherheitsmeldungen desselben Jahrgangs", () => {
    // Ohne das Entfernen erkannter Treffer teilten sich alle CVEs eines
    // Jahres die Kennung "CVE2026" und würden zu einer Meldung.
    const gruppen = gruppiere([
      inhalt("1", "CVE-2026-62835 Azure Portal Information Disclosure Vulnerability"),
      inhalt("2", "CVE-2026-56167 Azure AI Search Elevation of Privilege Vulnerability"),
      inhalt("3", "CVE-2026-54120 Microsoft Surface Remote Code Execution Vulnerability"),
    ]);
    expect(gruppen).toHaveLength(3);
  });

  it("führt weiterhin nach Titelähnlichkeit zusammen", () => {
    const gruppen = gruppiere([
      inhalt("1", "Microsoft responds to LG monitors installing McAfee ads on Windows"),
      inhalt("2", "Microsoft responds to LG monitors installing McAfee ads on Windows", "Quelle B"),
    ]);
    expect(gruppen).toHaveLength(1);
  });

  it("lässt unabhängige Meldungen getrennt", () => {
    const gruppen = gruppiere([
      inhalt("1", "Has OneDrive gone insane?!"),
      inhalt("2", "Sommerurlaub mit dem E-Auto: Ladenetz wächst schneller als der Bedarf"),
      inhalt("3", "Chick-fil-A data breach affects more than 13,000 customers"),
    ]);
    expect(gruppen).toHaveLength(3);
  });

  it("verbindet nicht über ein Bruchstück einer UUID", () => {
    const uuid = "ACF35976‑45A5‑0B48‑A913‑12C6F1A12083";
    const gruppen = gruppiere([
      inhalt("1", "Gerät entfernen", "Quelle A", `Meine Kennung lautet ${uuid}`),
      inhalt("2", "Ganz anderes Thema", "Quelle B", `Zufällig dieselbe Kennung ${uuid}`),
    ]);
    // Die Titel sind verschieden, die UUID darf nicht verbinden.
    expect(gruppen).toHaveLength(2);
  });

  it("wählt die ähnlichste Gruppe, nicht die erste passende", () => {
    const gruppen = gruppiereMitBegruendung([
      inhalt("1", "Drucker druckt nach Update nicht mehr farbig"),
      inhalt("2", "Scanner scannt nach Update nicht mehr farbig"),
      // Passt zu beiden, gehört aber eindeutig zum Drucker.
      inhalt("3", "Drucker druckt nach Update nicht mehr farbig unter Windows"),
    ]);
    const mitDrucker = gruppen.find((g) => g.inhalte.some((i) => i.inhaltId === "3"));
    expect(mitDrucker?.inhalte.map((i) => i.inhaltId)).toContain("1");
  });

  it("liefert für eine Einzelmeldung eine erkennbare Begründung", () => {
    const [gruppe] = gruppiereMitBegruendung([inhalt("1", "Has OneDrive gone insane?!")]);
    expect(gruppe?.begruendung).toBe("Einzelmeldung ohne Entsprechung");
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(gruppiere([])).toEqual([]);
  });
});
