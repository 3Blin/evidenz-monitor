/**
 * Misst die Gruppierung an den echten Inhalten des ersten Auftrags.
 *
 * Aufruf: npm run messen
 *
 * Zweck: Jede Änderung an der Zusammenführung wird an echten Daten belegt,
 * nicht an erfundenen Beispielen. Zweimal hat genau das einen Fehler
 * aufgedeckt, den erfundene Beispiele durchgelassen hätten.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gruppiereMitBegruendung, klassifiziereGruppe, type VorInhalt } from "../src/lib/vorklassifikation";
import { ermittleReifegrad, type Beleg } from "../src/lib/reifegrad";

function ladeInhalte(): readonly VorInhalt[] {
  const pfad = join(process.cwd(), "tests", "daten", "echte-inhalte.txt");
  return readFileSync(pfad, "utf8")
    .split("\n")
    .filter((z) => z.trim() && !z.startsWith("#"))
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

function main(): void {
  const inhalte = ladeInhalte();
  const gruppen = gruppiereMitBegruendung(inhalte);

  const mehrfach = gruppen.filter((g) => g.inhalte.length > 1);
  const uebergreifend = mehrfach.filter(
    (g) => new Set(g.inhalte.map((i) => i.herausgeber)).size > 1,
  );

  const stufen = new Map<number, number>();
  let unabhaengigeBelege = 0;
  for (const { inhalte: gruppe } of gruppen) {
    const befunde = klassifiziereGruppe(gruppe);
    const nachId = new Map(gruppe.map((i) => [i.inhaltId, i]));
    const belege: Beleg[] = befunde.flatMap((b) => {
      const inhalt = nachId.get(b.inhaltId);
      if (!inhalt) return [];
      if (b.beziehung === "unabhaengige_bestaetigung") unabhaengigeBelege++;
      return [{
        inhaltId: b.inhaltId,
        herausgeber: inhalt.herausgeber,
        quellentyp: inhalt.quellentyp,
        beziehung: b.beziehung,
        klassifikation: b.klassifikation,
        technischNachvollziehbar: false,
        erfasstAm: new Date(),
      }];
    });
    const stufe = ermittleReifegrad(belege).stufe;
    stufen.set(stufe, (stufen.get(stufe) ?? 0) + 1);
  }

  process.stdout.write(`Inhalte:                        ${inhalte.length}\n`);
  process.stdout.write(`Gruppen:                        ${gruppen.length}\n`);
  process.stdout.write(`davon mit mehreren Belegen:     ${mehrfach.length}\n`);
  process.stdout.write(`davon herausgeberuebergreifend: ${uebergreifend.length}\n`);
  process.stdout.write(`Belege "unabhaengige Bestaetigung": ${unabhaengigeBelege}\n`);
  process.stdout.write("\nStufenverteilung:\n");
  for (const stufe of [...stufen.keys()].sort((a, b) => a - b)) {
    process.stdout.write(`  Stufe ${stufe}: ${stufen.get(stufe)}\n`);
  }

  process.stdout.write("\nZusammengefuehrte Gruppen:\n");
  for (const g of mehrfach) {
    const wer = [...new Set(g.inhalte.map((i) => i.herausgeber))].join(" + ");
    process.stdout.write(`  [${wer}] ${g.begruendung}\n`);
    for (const i of g.inhalte) process.stdout.write(`      ${i.titel.slice(0, 88)}\n`);
  }
}

main();
