/** Legt den ersten Beobachtungsauftrag als DATEN an (kein Code, themenneutral). */
import pg from "pg";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const NUTZER = "00000000-0000-0000-0000-000000000001";

// oeffentliche_demo: ohne Anmeldung lesbar (ADR 0004). Vor dem echten
// Produktivbetrieb bewusst bestätigen oder abschalten.
const { rows } = await db.query(
  `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,suchbegriffe,intervall_minuten,dashboard_config,oeffentliche_demo)
   VALUES ($1,$2,$3,$4,$5,$6,$7,true)
   ON CONFLICT (user_id,name) DO UPDATE SET zielbeschreibung=EXCLUDED.zielbeschreibung
   RETURNING id`,
  [NUTZER, "Windows 11 Updates & Probleme",
   "Beobachte neu auftretende Probleme mit Windows-11-Updates, betroffene Builds und Hardware, Workarounds und offizielle Bestätigungen.",
   "Welche Probleme treten nach aktuellen Windows-11-Updates auf, wie belastbar sind die Hinweise und was empfiehlt der Hersteller?",
   ["Windows 11","25H2","Update","KB","Treiber","Bluescreen"], 360,
   JSON.stringify({ widgets: ["quellen_graph","evidenz_panel","zeitverlauf"] })]
);
const auftragId = rows[0].id;

const quellen = [
  ["https://www.reddit.com/r/Windows11/new/.rss", "community", "Reddit r/Windows11"],
  ["https://www.reddit.com/r/sysadmin/new/.rss", "community", "Reddit r/sysadmin"],
  ["https://www.elevenforum.com/whats-new/posts/index.rss", "forum", "ElevenForum"],
  ["https://www.heise.de/rss/heise-atom.xml", "fachmedium", "heise online"],
  ["https://www.bleepingcomputer.com/feed/", "fachmedium", "BleepingComputer"],
  ["https://api.msrc.microsoft.com/update-guide/rss", "hersteller_offiziell", "Microsoft MSRC"],
];
for (const [url, typ, herausgeber] of quellen) {
  await db.query(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber,sprache) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (auftrag_id,url) DO NOTHING`,
    [auftragId, url, typ, herausgeber, herausgeber.includes("heise") ? "de" : "en"]
  );
}
process.stdout.write(String(JSON.stringify({ auftragId, quellen: quellen.length })) + "\n");
await db.end();
