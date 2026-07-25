/** Führt einen echten Sammellauf aus (Nachweis Phase 3). */
import pg from "pg";
import Parser from "rss-parser";
import { createHash } from "node:crypto";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const parser = new Parser({ timeout: 15000, headers: { "User-Agent": "EvidenzMonitor/0.1 (+Beobachtungsauftrag)" } });

function hash(t, a) { return createHash("sha256").update(`${t}\n${a}`.toLowerCase().replace(/\s+/g," ").trim()).digest("hex"); }
function auszug(s, max=1200) { const b=(s??"").replace(/\s+/g," ").trim(); return b.length<=max?b:b.slice(0,max)+" […]"; }

const { rows: quellen } = await db.query("SELECT id,url,typ,herausgeber FROM quellen WHERE aktiv=true");
const ergebnis = [];
for (const q of quellen) {
  try {
    const feed = await parser.parseURL(q.url);
    let neu = 0;
    for (const item of (feed.items ?? []).slice(0, 25)) {
      if (!item.link || !item.title) continue;
      const a = auszug(item.contentSnippet ?? item.content ?? item.title);
      const r = await db.query(
        `INSERT INTO inhalte (quelle_id,url,titel,autor,veroeffentlicht_am,auszug,inhalt_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (quelle_id,inhalt_hash) DO NOTHING RETURNING id`,
        [q.id, item.link, item.title, item.creator ?? null, item.isoDate ? new Date(item.isoDate) : null, a, hash(item.title, a)]
      );
      if (r.rowCount) neu++;
    }
    await db.query("INSERT INTO abrufe (quelle_id,status,neue_inhalte) VALUES ($1,'ok',$2)", [q.id, neu]);
    ergebnis.push({ quelle: q.herausgeber, status: "ok", neu });
  } catch (e) {
    await db.query("INSERT INTO abrufe (quelle_id,status,fehler_text) VALUES ($1,'fehler',$2)", [q.id, String(e.message).slice(0,200)]);
    ergebnis.push({ quelle: q.herausgeber, status: "FEHLER", fehler: String(e.message).slice(0,60) });
  }
}
process.stdout.write(ergebnis.map(e=>`  ${e.quelle}: ${e.status}${e.neu!==undefined?" (+"+e.neu+" neu)":""}${e.fehler?" - "+e.fehler:""}`).join("\n")+"\n");
const { rows: z } = await db.query("SELECT count(*)::int AS n FROM inhalte");
process.stdout.write(String("Inhalte gesamt:", z[0].n) + "\n");
await db.end();
