/**
 * Vorschlag für Relevanzregeln und Quellen aus der Fragestellung.
 *
 * Anlass: Die Rückmeldung aus der ersten Nutzung lautete, die Felder
 * "Suchbegriffe", "Pflichtbegriffe", "Ausschlussbegriffe" und "nötige Treffer"
 * überforderten - sie setzen voraus, dass man das Regelwerk bereits versteht.
 * Der Ausweg ist nicht, sie zu verstecken: Sie entscheiden über die Qualität
 * des Ergebnisses, und wer sie nie sieht, kann ein schlechtes Ergebnis nicht
 * verbessern. Der Ausweg ist ein brauchbarer erster Vorschlag, den man
 * versteht, weil er begründet ist, und danach ändern kann.
 *
 * Arbeitsteilung wie in den Anforderungen festgelegt: Die KI liest und
 * formuliert, entschieden wird deterministisch. Sie schlägt hier Begriffe vor
 * - angewandt werden sie von `pruefeRelevanz`, und übernommen werden sie erst,
 * wenn ein Mensch auf Speichern drückt.
 *
 * Dieses Modul enthält keinen Netzzugriff, damit es vollständig prüfbar
 * bleibt (Modulgrenze 3): Es baut die Anweisung und prüft die Antwort.
 */
import { z } from "zod";

export interface Auftragsbeschreibung {
  readonly name: string;
  readonly fragestellung: string;
  readonly zielbeschreibung?: string;
}

/** Quellentypen aus dem Schema (Migration 0001). */
const QUELLENTYPEN = [
  "hersteller_offiziell", "status_seite", "fachmedium", "forum",
  "community", "rss", "api", "sonstige",
] as const;

const vorschlagSchema = z.object({
  suchbegriffe: z.array(z.string().min(1).max(60)).max(25),
  pflichtbegriffe: z.array(z.string().min(1).max(60)).max(8),
  ausschlussbegriffe: z.array(z.string().min(1).max(60)).max(15),
  mindestTreffer: z.number().int().min(1).max(10),
  quellen: z
    .array(
      z.object({
        url: z.string().url().max(500),
        herausgeber: z.string().min(1).max(120),
        typ: z.enum(QUELLENTYPEN),
        themenspezifisch: z.boolean(),
        begruendung: z.string().max(300).optional().default(""),
      }),
    )
    .max(12)
    .optional()
    .default([]),
  begruendung: z.string().max(1200),
});

export type Regelvorschlag = z.infer<typeof vorschlagSchema>;

/**
 * Die Anweisung an das Sprachmodell.
 *
 * Bewusst ohne jedes Beispiel aus einem konkreten Sachgebiet: Ein Beispiel mit
 * Windows-Bezug hätte das Modell auf Technikthemen gezogen, und der Kern muss
 * themenneutral bleiben. Erklärt wird stattdessen die *Bedeutung* der Felder.
 */
export function baueAnweisung(auftrag: Auftragsbeschreibung): string {
  const ziel = auftrag.zielbeschreibung?.trim();
  return [
    "Du hilfst beim Einrichten einer Beobachtung. Aus einer Fragestellung sollen",
    "Filterregeln entstehen, mit denen ein Programm später Beiträge aussortiert.",
    "",
    "Bedeutung der Felder:",
    "- suchbegriffe: Wörter, die in einem einschlägigen Beitrag vorkommen können.",
    "  Ein Beitrag muss mindestens so viele verschiedene davon enthalten, wie",
    "  mindestTreffer angibt.",
    "- pflichtbegriffe: Wörter, die in JEDEM einschlägigen Beitrag vorkommen",
    "  müssen. Sparsam wählen - meist genügt der zentrale Gegenstand. Zu viele",
    "  Pflichtbegriffe sortieren richtige Beiträge aus.",
    "- ausschlussbegriffe: Wörter, die einen Beitrag sicher ungeeignet machen.",
    "- mindestTreffer: 1 ist die Vorgabe. Höher nur, wenn die Suchbegriffe für",
    "  sich genommen sehr allgemein sind.",
    "- quellen: Öffentlich erreichbare Adressen, bevorzugt RSS- oder Atom-Feeds,",
    "  die zu dieser Fragestellung regelmäßig berichten. themenspezifisch ist",
    "  true, wenn die Adresse selbst das Thema schon eingrenzt (etwa ein Feed zu",
    "  genau diesem Gegenstand); bei breiten Nachrichtenfeeds false.",
    "",
    "Regeln:",
    "- Begriffe treffen am Wortanfang. Ein kurzer Wortstamm findet daher auch",
    "  längere Formen.",
    "- Schreibe die Begriffe in der Sprache, in der über das Thema berichtet wird.",
    "- Erfinde keine Adressen. Nenne nur Quellen, deren Bestehen dir bekannt ist.",
    "  Lieber wenige sichere als viele geratene.",
    "- Antworte ausschließlich mit einem JSON-Objekt, ohne Text davor oder danach.",
    "",
    "Felder des JSON-Objekts: suchbegriffe (Liste von Zeichenketten),",
    "pflichtbegriffe (Liste), ausschlussbegriffe (Liste), mindestTreffer (Zahl),",
    "quellen (Liste von Objekten mit url, herausgeber, typ, themenspezifisch,",
    `begruendung; typ ist eines von: ${QUELLENTYPEN.join(", ")}),`,
    "begruendung (ein kurzer Absatz in Alltagssprache, der die Wahl erklärt).",
    "",
    "Die Beobachtung:",
    `Name: ${auftrag.name}`,
    `Fragestellung: ${auftrag.fragestellung}`,
    ...(ziel ? [`Was genau beobachtet werden soll: ${ziel}`] : []),
  ].join("\n");
}

/**
 * Liest die Antwort des Modells.
 *
 * Modelle rahmen JSON gern in ```-Blöcke oder stellen einen Satz voran. Das
 * abzufangen ist keine Nachlässigkeit, sondern der Normalfall - und ein
 * abgewiesener Vorschlag wegen dreier Backticks wäre für die Nutzerin nicht
 * nachvollziehbar.
 */
export function leseVorschlag(roh: string): Regelvorschlag {
  const text = schaeleJson(roh);
  let daten: unknown;
  try {
    daten = JSON.parse(text);
  } catch {
    throw new Error("Die KI hat kein verwertbares JSON geliefert.");
  }
  const geprueft = vorschlagSchema.safeParse(daten);
  if (!geprueft.success) {
    throw new Error(
      `Die Antwort der KI passt nicht zum erwarteten Aufbau: ${geprueft.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return bereinige(geprueft.data);
}

/** Holt das JSON-Objekt aus einer Antwort mit Rahmen oder Vorrede. */
export function schaeleJson(roh: string): string {
  const ohneRahmen = roh.replace(/```(?:json)?/gi, "").trim();
  const anfang = ohneRahmen.indexOf("{");
  const ende = ohneRahmen.lastIndexOf("}");
  if (anfang === -1 || ende === -1 || ende < anfang) return ohneRahmen;
  return ohneRahmen.slice(anfang, ende + 1);
}

/**
 * Räumt den Vorschlag auf, bevor er in die Oberfläche geht.
 *
 * Wichtig ist die letzte Zeile: mindestTreffer darf nie größer sein als die
 * Zahl der Suchbegriffe. Sonst entstünde eine Regel, die kein Beitrag erfüllen
 * kann - das Dashboard bliebe dauerhaft leer, ohne erkennbaren Grund.
 */
function bereinige(v: Regelvorschlag): Regelvorschlag {
  const eindeutig = (liste: readonly string[]): string[] => {
    const gesehen = new Set<string>();
    const ergebnis: string[] = [];
    for (const roh of liste) {
      const wert = roh.trim();
      if (!wert) continue;
      const schluessel = wert.toLowerCase();
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      ergebnis.push(wert);
    }
    return ergebnis;
  };

  const suchbegriffe = eindeutig(v.suchbegriffe);
  return {
    ...v,
    suchbegriffe,
    pflichtbegriffe: eindeutig(v.pflichtbegriffe),
    ausschlussbegriffe: eindeutig(v.ausschlussbegriffe),
    mindestTreffer: Math.max(1, Math.min(v.mindestTreffer, Math.max(1, suchbegriffe.length))),
  };
}
