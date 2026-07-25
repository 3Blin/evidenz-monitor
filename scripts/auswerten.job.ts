/**
 * Auswertungslauf: gruppiert gesammelte Inhalte, klassifiziert sie
 * deterministisch vor und vergibt den Reifegrad über das Regelwerk.
 *
 * Der Ablauf steckt in einer Funktion, nicht auf der obersten Ebene: Nur so
 * lässt sich das Skript mit tsx ausführen (Aufruf: npm run auswerten).
 */
import pg from "pg";
import { gruppiere, klassifiziereGruppe, type VorInhalt } from "../src/lib/vorklassifikation";
import { ermittleReifegrad, REGEL_VERSION, type Beleg } from "../src/lib/reifegrad";

interface InhaltZeile extends VorInhalt {
  readonly auszug: string;
}

async function main(): Promise<void> {
  const db = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

  try {
    const { rows: auftraege } = await db.query<{ id: string; suchbegriffe: string[] }>(
      "SELECT id, suchbegriffe FROM auftraege LIMIT 1",
    );
    const auftrag = auftraege[0];
    if (!auftrag) throw new Error("Kein Beobachtungsauftrag vorhanden");

    const { rows: inhalte } = await db.query<InhaltZeile>(
      `SELECT i.id AS "inhaltId", i.titel, i.auszug, i.veroeffentlicht_am AS "veroeffentlichtAm",
              q.typ AS "quellentyp", q.herausgeber
       FROM inhalte i JOIN quellen q ON q.id=i.quelle_id
       WHERE q.auftrag_id=$1 AND q.aktiv=true
         AND (i.titel ILIKE ANY($2) OR i.auszug ILIKE ANY($2))`,
      [auftrag.id, auftrag.suchbegriffe.map((s) => `%${s}%`)],
    );
    process.stdout.write(`Thematisch relevante Inhalte: ${inhalte.length}\n`);

    await db.query("DELETE FROM meldungsgruppen WHERE auftrag_id=$1", [auftrag.id]);
    await db.query("DELETE FROM aussagen WHERE auftrag_id=$1", [auftrag.id]);

    const gruppen = gruppiere(inhalte);
    process.stdout.write(`Meldungsgruppen: ${gruppen.length}\n`);

    const nachId = new Map(inhalte.map((i) => [i.inhaltId, i]));
    let anzahl = 0;

    for (const gruppe of gruppen) {
      const erster = gruppe[0];
      if (!erster) continue;
      const befunde = klassifiziereGruppe(gruppe);

      const { rows: g } = await db.query<{ id: string }>(
        "INSERT INTO meldungsgruppen (auftrag_id, kanonischer_titel) VALUES ($1,$2) RETURNING id",
        [auftrag.id, erster.titel.slice(0, 200)],
      );
      const gruppeId = g[0]?.id;
      if (!gruppeId) continue;

      const { rows: a } = await db.query<{ id: string }>(
        `INSERT INTO aussagen (auftrag_id, sachverhalt, entitaeten, zeitraum_von, kontext)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [auftrag.id, erster.titel.slice(0, 500), [], erster.veroeffentlichtAm,
         "Deterministische Vorklassifikation; KI-Analyse noch nicht ausgeführt"],
      );
      const aussageId = a[0]?.id;
      if (!aussageId) continue;
      anzahl++;

      const belege: Beleg[] = [];
      for (const b of befunde) {
        const inhalt = nachId.get(b.inhaltId);
        if (!inhalt) continue;
        await db.query(
          `INSERT INTO inhalt_gruppen (inhalt_id, gruppe_id, beziehung, begruendung)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [b.inhaltId, gruppeId, b.beziehung, b.begruendung],
        );
        await db.query(
          `INSERT INTO aussage_belege (aussage_id, inhalt_id, belegstelle, klassifikation)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [aussageId, b.inhaltId, inhalt.auszug.slice(0, 400), b.klassifikation],
        );
        belege.push({
          inhaltId: b.inhaltId,
          herausgeber: inhalt.herausgeber,
          quellentyp: inhalt.quellentyp,
          beziehung: b.beziehung,
          klassifikation: b.klassifikation,
          technischNachvollziehbar: false,
          erfasstAm: new Date(),
        });
      }

      const bewertung = ermittleReifegrad(belege);
      await db.query(
        `INSERT INTO reifegrad_verlauf (aussage_id, stufe, ausloeser, regel_version)
         VALUES ($1,$2,$3,$4)`,
        [aussageId, bewertung.stufe, bewertung.ausloeser, REGEL_VERSION],
      );
    }

    process.stdout.write(`Aussagen mit Reifegrad: ${anzahl}\n`);
    const { rows: verteilung } = await db.query<{ stufe: number; anzahl: string }>(
      "SELECT stufe, count(*)::text AS anzahl FROM reifegrad_verlauf GROUP BY stufe ORDER BY stufe",
    );
    for (const v of verteilung) process.stdout.write(`  Stufe ${v.stufe}: ${v.anzahl} Aussagen\n`);
  } finally {
    await db.end();
  }
}

main().catch((fehler: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`${fehler instanceof Error ? fehler.message : String(fehler)}\n`);
});
