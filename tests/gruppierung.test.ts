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
  return {
    inhaltId, titel, herausgeber, quellentyp: "forum", veroeffentlichtAm: null, auszug,
    url: `https://${herausgeber.toLowerCase().replace(/\s+/g, "")}.example/${inhaltId}`,
  };
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

describe("Kennungen trennen", () => {
  it("verschmilzt nicht drei Sicherheitslücken wegen ihrer Formelwörter", () => {
    // Der Fund aus der Messung an den echten Daten: Titelähnlichkeit 0,64
    // allein durch "Microsoft ... Remote Code Execution Vulnerability". Weil
    // MSRC eine Herstellerquelle ist, stand das Ergebnis auf Stufe 6 -
    // eine amtlich klingende Aussage über einen Sachverhalt, den es so nicht
    // gibt.
    const gruppen = gruppiere([
      inhalt("1", "CVE-2026-54120 Microsoft Surface Remote Code Execution Vulnerability", "MSRC"),
      inhalt("2", "CVE-2026-56165 Microsoft Account Remote Code Execution Vulnerability", "MSRC"),
      inhalt("3", "CVE-2026-50517 Microsoft M365 Copilot Remote Code Execution Vulnerability", "MSRC"),
    ]);
    expect(gruppen).toHaveLength(3);
  });

  it("trennt auch bei sehr hoher Titelähnlichkeit", () => {
    const gruppen = gruppiere([
      inhalt("1", "CVE-2026-63136 Uncontrolled Resource Consumption in Elasticsearch"),
      inhalt("2", "CVE-2026-56145 Uncontrolled Resource Consumption in Elasticsearch"),
    ]);
    expect(gruppen).toHaveLength(2);
  });

  it("trennt nicht, wenn nur einer der beiden eine Kennung trägt", () => {
    // Nichts ist bewiesen: Der zweite Beitrag könnte dieselbe Sache meinen
    // und die Kennung nur nicht nennen. Dann entscheidet der Titel.
    const gruppen = gruppiere([
      inhalt("1", "Drucker streikt nach Update KB5094126 im Dauerbetrieb"),
      inhalt("2", "Drucker streikt nach Update im Dauerbetrieb"),
    ]);
    expect(gruppen).toHaveLength(1);
  });
});

describe("Zeitfenster", () => {
  function mitDatum(id: string, titel: string, datum: string): VorInhalt {
    return { ...inhalt(id, titel), veroeffentlichtAm: new Date(datum) };
  }

  it("führt ähnliche Titel innerhalb des Zeitfensters zusammen", () => {
    const gruppen = gruppiere([
      mitDatum("1", "Monatlicher Sicherheitsbericht des Verbandes", "2026-07-01"),
      mitDatum("2", "Monatlicher Sicherheitsbericht des Verbandes", "2026-07-20"),
    ]);
    expect(gruppen).toHaveLength(1);
  });

  it("trennt denselben Titel aus verschiedenen Jahrgängen", () => {
    const gruppen = gruppiere([
      mitDatum("1", "Monatlicher Sicherheitsbericht des Verbandes", "2026-01-01"),
      mitDatum("2", "Monatlicher Sicherheitsbericht des Verbandes", "2026-07-01"),
    ]);
    expect(gruppen).toHaveLength(2);
  });

  it("lässt eine gemeinsame Kennung das Zeitfenster überschreiben", () => {
    // Dieselbe Sicherheitslücke bleibt dieselbe, auch nach einem halben Jahr.
    const gruppen = gruppiere([
      mitDatum("1", "Erste Meldung zu KB5094126", "2026-01-01"),
      mitDatum("2", "Ganz anders formulierter Nachtrag zu KB5094126", "2026-07-01"),
    ]);
    expect(gruppen).toHaveLength(1);
  });

  it("gruppiert weiterhin, wenn ein Datum fehlt", () => {
    const gruppen = gruppiere([
      { ...inhalt("1", "Gleicher Titel ohne Datum"), veroeffentlichtAm: null },
      mitDatum("2", "Gleicher Titel ohne Datum", "2026-07-01"),
    ]);
    expect(gruppen).toHaveLength(1);
  });
});

describe("Verweise", () => {
  it("führt zwei Beiträge zusammen, die dieselbe fremde Seite verlinken", () => {
    const gruppen = gruppiere([
      inhalt("1", "Aggregator meldet Vorgang", "Aggregator A",
        "Article URL: https://arstechnica.com/gadgets/2026/07/vorgang/"),
      inhalt("2", "Ganz anderer Titel zum selben Fall", "Aggregator B",
        "Quelle: https://www.arstechnica.com/gadgets/2026/07/vorgang?utm_source=rss"),
    ]);
    expect(gruppen).toHaveLength(1);
  });

  it("verbindet nicht über Verweise auf die eigene Plattform", () => {
    const gruppen = gruppiere([
      inhalt("1", "Erster Beitrag", "Forum",
        "Comments URL: https://news.ycombinator.com/item?id=49031099"),
      inhalt("2", "Zweiter Beitrag ohne Bezug", "Forum",
        "Comments URL: https://news.ycombinator.com/item?id=49021080"),
    ]);
    expect(gruppen).toHaveLength(2);
  });
});

describe("Prüfung gegen alle Mitglieder", () => {
  it("nimmt einen Beitrag auf, der nur zum zweiten Mitglied passt", () => {
    // Vorher entschied allein das erste Mitglied einer Gruppe. Damit hing das
    // Ergebnis an der Reihenfolge der Beiträge statt an ihrem Inhalt.
    const gruppen = gruppiere([
      inhalt("A", "Drucker verliert Farbe nach Aktualisierung"),
      inhalt("B", "Drucker verliert Farbe nach Aktualisierung im Netzwerk"),
      inhalt("C", "Verliert Farbe nach Aktualisierung im Netzwerk beim Duplexdruck"),
    ]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]).toHaveLength(3);
  });

  it("liefert dasselbe Ergebnis bei umgekehrter Reihenfolge", () => {
    const eingabe = [
      inhalt("A", "Drucker verliert Farbe nach Aktualisierung"),
      inhalt("B", "Drucker verliert Farbe nach Aktualisierung im Netzwerk"),
      inhalt("C", "Verliert Farbe nach Aktualisierung im Netzwerk beim Duplexdruck"),
    ];
    expect(gruppiere(eingabe).length).toBe(gruppiere([...eingabe].reverse()).length);
  });
});

describe("Zeitfenster als Aufrufwert (ADR 0015)", () => {
  // Zwei Beiträge mit gleichlautendem Titel, aber vier Jahre auseinander.
  // Ohne Datum gälten sie als nah beieinander; deshalb tragen sie hier eines.
  function mitDatum(id: string, titel: string, iso: string, herausgeber: string): VorInhalt {
    return {
      inhaltId: id, titel, herausgeber, quellentyp: "fachmedium",
      veroeffentlichtAm: new Date(iso), auszug: "",
      url: `https://${herausgeber}.example/${id}`,
    };
  }
  const paar = [
    mitDatum("1", "Warnung vor den Folgen der Umstellung", "2020-03-01T00:00:00Z", "a"),
    mitDatum("2", "Warnung vor den Folgen der Umstellung", "2024-03-01T00:00:00Z", "b"),
  ];

  it("trennt sie im Vorgabefenster", () => {
    expect(gruppiere(paar)).toHaveLength(2);
  });

  it("führt sie im weiten Rückblick zusammen", () => {
    // Der Wert, den die Triage bei einer rückblickenden Frage vorschlägt.
    // Ohne diesen Test wäre nicht belegt, dass der Wert überhaupt ankommt -
    // und eine Einstellung, die nichts bewirkt, ist schlimmer als keine.
    expect(gruppiere(paar, 3650)).toHaveLength(1);
  });

  it("trennt sie im engen Fenster einer frischen Behauptung", () => {
    expect(gruppiere(paar, 14)).toHaveLength(2);
  });
});
