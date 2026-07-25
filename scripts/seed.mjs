/**
 * Legt die Demo-Beobachtungsaufträge als DATEN an (kein Code, themenneutral).
 *
 * Zwei Aufträge aus verschiedenen Bereichen, absichtlich: Der Kern kennt kein
 * Thema, und genau das soll sichtbar sein. Derselbe Sammellauf, dieselbe
 * Bewertung, dieselbe Oberfläche - nur andere Datensätze. Weitere Aufträge
 * entstehen über die Verwaltung, nicht hier.
 *
 * oeffentliche_demo: ohne Anmeldung lesbar (ADR 0004). Vor dem echten
 * Produktivbetrieb bewusst bestätigen oder abschalten.
 */
import pg from "pg";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const NUTZER = "00000000-0000-0000-0000-000000000001";

// Die Relevanzregeln (ADR 0008) sind je Auftrag verschieden - das ist der
// Kern der Themenneutralität:
//
// Windows: ohne "Windows" ist eine Meldung unbrauchbar, sonst genügt das Wort
//   "Updates" in einem beliebigen IT-Artikel. Ein Pflichtbegriff, ein Treffer.
// Sicherheitslücken: es gibt kein einzelnes Pflichtwort, das alle Meldungen
//   tragen würde. Stattdessen müssen zwei verschiedene Fachbegriffe treffen -
//   ein einzelnes "Patch" reicht nicht.
const auftraege = [
  {
    name: "Windows 11 Updates & Probleme",
    ziel: "Beobachte neu auftretende Probleme mit Windows-11-Updates, betroffene Builds und Hardware, Workarounds und offizielle Bestätigungen.",
    frage: "Welche Probleme treten nach aktuellen Windows-11-Updates auf, wie belastbar sind die Hinweise und was empfiehlt der Hersteller?",
    suchbegriffe: ["Windows 11", "25H2", "Update", "KB", "Treiber", "Bluescreen"],
    pflichtbegriffe: ["Windows"],
    ausschlussbegriffe: [],
    mindestTreffer: 1,
    // themenspezifisch (letzter Wert): Die Adresse begrenzt die Quelle schon
    // auf das Thema, die Pflichtbegriffe gelten dort als erfüllt. r/sysadmin,
    // heise und BleepingComputer berichten über alles, MSRC deckt alle
    // Microsoft-Produkte ab - dort muss der Text das Thema belegen.
    quellen: [
      ["https://www.reddit.com/r/Windows11/new/.rss", "community", "Reddit r/Windows11", "en", true],
      ["https://www.reddit.com/r/sysadmin/new/.rss", "community", "Reddit r/sysadmin", "en", false],
      ["https://www.elevenforum.com/whats-new/posts/index.rss", "forum", "ElevenForum", "en", true],
      ["https://www.heise.de/rss/heise-atom.xml", "fachmedium", "heise online", "de", false],
      ["https://www.bleepingcomputer.com/feed/", "fachmedium", "BleepingComputer", "en", false],
      ["https://api.msrc.microsoft.com/update-guide/rss", "hersteller_offiziell", "Microsoft MSRC", "en", false],
    ],
  },
  {
    name: "Sicherheitslücken in eingesetzter Software",
    ziel: "Beobachte neu bekannt werdende Schwachstellen in verbreiteter Software, ihre Ausnutzbarkeit und verfügbare Gegenmaßnahmen.",
    frage: "Welche Schwachstellen sind neu bekannt, wie belastbar sind die Hinweise und gibt es bereits Gegenmaßnahmen?",
    suchbegriffe: ["CVE", "Schwachstelle", "Sicherheitslücke", "Zero-Day", "Exploit", "Patch"],
    pflichtbegriffe: [],
    ausschlussbegriffe: [],
    mindestTreffer: 2,
    quellen: [
      ["https://www.heise.de/security/rss/news-atom.xml", "fachmedium", "heise Security", "de", true],
      ["https://www.bleepingcomputer.com/feed/", "fachmedium", "BleepingComputer", "en", false],
    ],
  },
];

const ergebnis = [];

for (const a of auftraege) {
  const { rows } = await db.query(
    `INSERT INTO auftraege
       (user_id,name,zielbeschreibung,fragestellung,suchbegriffe,pflichtbegriffe,
        ausschlussbegriffe,mindest_treffer,intervall_minuten,dashboard_config,oeffentliche_demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,360,$9,true)
     ON CONFLICT (user_id,name) DO UPDATE SET
       zielbeschreibung=EXCLUDED.zielbeschreibung,
       fragestellung=EXCLUDED.fragestellung,
       suchbegriffe=EXCLUDED.suchbegriffe,
       pflichtbegriffe=EXCLUDED.pflichtbegriffe,
       ausschlussbegriffe=EXCLUDED.ausschlussbegriffe,
       mindest_treffer=EXCLUDED.mindest_treffer,
       oeffentliche_demo=EXCLUDED.oeffentliche_demo
     RETURNING id`,
    [NUTZER, a.name, a.ziel, a.frage, a.suchbegriffe, a.pflichtbegriffe,
     a.ausschlussbegriffe, a.mindestTreffer,
     JSON.stringify({ widgets: ["quellen_graph", "evidenz_panel", "zeitverlauf"] })]
  );
  const auftragId = rows[0].id;

  for (const [url, typ, herausgeber, sprache, themenspezifisch] of a.quellen) {
    await db.query(
      `INSERT INTO quellen (auftrag_id,url,typ,herausgeber,sprache,themenspezifisch)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (auftrag_id,url) DO UPDATE SET themenspezifisch=EXCLUDED.themenspezifisch`,
      [auftragId, url, typ, herausgeber, sprache, themenspezifisch]
    );
  }
  ergebnis.push({ name: a.name, auftragId, quellen: a.quellen.length });
}

process.stdout.write(JSON.stringify(ergebnis, null, 1) + "\n");
process.stdout.write(
  "\nHinweis: NEXT_PUBLIC_AUFTRAG bestimmt nur die Vorauswahl. Alle als Demo\n" +
  "freigegebenen Aufträge stehen in der Oberfläche zur Auswahl.\n"
);
await db.end();
