/**
 * Aufbau der Graph-Daten für das Dashboard. Zweck: Jede Quelle ist ein Punkt,
 * Verbindungen zeigen den Quellverkehr - also wer von wem übernommen hat.
 * Reine Datenaufbereitung ohne Netz- und Datenbankzugriff (testbar).
 */
import type { Beziehung } from "./reifegrad";

export interface GraphKnoten {
  readonly id: string;
  readonly label: string;
  readonly quellentyp: string;
  /** Anzahl Beiträge dieser Quelle - steuert die Punktgröße. */
  readonly gewicht: number;
  /** true, wenn die Quelle eine offizielle Primärquelle ist. */
  readonly offiziell: boolean;
}

export interface GraphKante {
  readonly von: string;
  readonly nach: string;
  readonly art: Beziehung;
}

export interface InhaltMitQuelle {
  readonly inhaltId: string;
  readonly quelleId: string;
  readonly herausgeber: string;
  readonly quellentyp: string;
  readonly gruppeId: string | null;
  readonly beziehung: Beziehung | null;
}

const OFFIZIELLE_TYPEN = new Set(["hersteller_offiziell", "status_seite"]);

/**
 * Baut Knoten und Kanten. Kanten entstehen, wenn ein Beitrag als Übernahme,
 * Zitat oder Zusammenfassung eines Primärbeitrags derselben Gruppe erkannt wurde.
 */
export function baueGraph(inhalte: readonly InhaltMitQuelle[]): {
  knoten: readonly GraphKnoten[];
  kanten: readonly GraphKante[];
} {
  const knotenMap = new Map<string, { label: string; typ: string; anzahl: number }>();
  for (const i of inhalte) {
    const vorhanden = knotenMap.get(i.quelleId);
    if (vorhanden) {
      vorhanden.anzahl++;
    } else {
      knotenMap.set(i.quelleId, { label: i.herausgeber, typ: i.quellentyp, anzahl: 1 });
    }
  }
  const knoten: GraphKnoten[] = [...knotenMap.entries()].map(([id, k]) => ({
    id,
    label: k.label,
    quellentyp: k.typ,
    gewicht: k.anzahl,
    offiziell: OFFIZIELLE_TYPEN.has(k.typ),
  }));

  // Primärquelle je Gruppe bestimmen
  const primaerJeGruppe = new Map<string, string>();
  for (const i of inhalte) {
    if (i.gruppeId && i.beziehung === "primaer" && !primaerJeGruppe.has(i.gruppeId)) {
      primaerJeGruppe.set(i.gruppeId, i.quelleId);
    }
  }

  const gesehen = new Set<string>();
  const kanten: GraphKante[] = [];
  for (const i of inhalte) {
    if (!i.gruppeId || !i.beziehung || i.beziehung === "primaer") continue;
    const von = primaerJeGruppe.get(i.gruppeId);
    if (!von || von === i.quelleId) continue;
    const schluessel = `${von}->${i.quelleId}:${i.beziehung}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    kanten.push({ von, nach: i.quelleId, art: i.beziehung });
  }
  return { knoten, kanten };
}
