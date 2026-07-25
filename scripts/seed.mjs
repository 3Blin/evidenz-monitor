/** Legt den ersten Beobachtungsauftrag als DATEN an (kein Code, themenneutral). */
import pg from "pg";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const NUTZER = "00000000-0000-0000-0000-000000000001";

// oeffentliche_demo: ohne Anmeldung lesbar (ADR 0004). Vor dem echten
// Produktivbetrieb bewusst bestätigen oder abschalten.
// pflichtbegriffe: Ohne "Windows" ist eine Meldung für diesen Auftrag
// unbrauchbar - sonst genügt das Wort "Updates" in einem beliebigen
// IT-Artikel (ADR 0008). Die Begriffe sind Daten, kein Code: ein Auftrag zu
// einem anderen Thema setzt hier andere Werte.
const { rows } = await db.query(
  `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,suchbegriffe,intervall_minuten,dashboard_config,oeffentliche_demo,pflichtbegriffe)
   VALUES ($1,$2,$3,$4,$5,$6,$7,true,ARRAY['Windows'])
   ON CONFLICT (user_id,name) DO UPDATE SET zielbeschreibung=EXCLUDED.zielbeschreibung,
     pflichtbegriffe=EXCLUDED.pflichtbegriffe
   RETURNING id`,
  [NUTZER, "Windows 11 Updates & Probleme",
   "Beobachte neu auftretende Probleme mit Windows-11-Updates, betroffene Builds und Hardware, Workarounds und offizielle Bestätigungen.",
   "Welche Probleme treten nach aktuellen Windows-11-Updates auf, wie belastbar sind die Hinweise und was empfiehlt der Hersteller?",
   ["Windows 11","25H2","Update","KB","Treiber","Bluescreen"], 360,
   JSON.stringify({ widgets: ["quellen_graph","evidenz_panel","zeitverlauf"] })]
);
const auftragId = rows[0].id;

// themenspezifisch (letzte Spalte): Die Adresse begrenzt die Quelle schon auf
// das Thema, die Pflichtbegriffe gelten dort als erfüllt (ADR 0008).
// r/sysadmin, heise und BleepingComputer berichten über alles, MSRC deckt alle
// Microsoft-Produkte ab - dort muss der Text das Thema belegen.
const quellen = [
  ["https://www.reddit.com/r/Windows11/new/.rss", "community", "Reddit r/Windows11", true],
  ["https://www.reddit.com/r/sysadmin/new/.rss", "community", "Reddit r/sysadmin", false],
  ["https://www.elevenforum.com/whats-new/posts/index.rss", "forum", "ElevenForum", true],
  ["https://www.heise.de/rss/heise-atom.xml", "fachmedium", "heise online", false],
  ["https://www.bleepingcomputer.com/feed/", "fachmedium", "BleepingComputer", false],
  ["https://api.msrc.microsoft.com/update-guide/rss", "hersteller_offiziell", "Microsoft MSRC", false],
];
for (const [url, typ, herausgeber, themenspezifisch] of quellen) {
  await db.query(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber,sprache,themenspezifisch)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (auftrag_id,url) DO UPDATE SET themenspezifisch=EXCLUDED.themenspezifisch`,
    [auftragId, url, typ, herausgeber, herausgeber.includes("heise") ? "de" : "en", themenspezifisch]
  );
}
process.stdout.write(String(JSON.stringify({ auftragId, quellen: quellen.length })) + "\n");
await db.end();
