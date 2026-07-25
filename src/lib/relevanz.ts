/**
 * Relevanzprüfung eines Inhalts gegen einen Beobachtungsauftrag.
 *
 * Zweck: Erfolgskriterium 6 verlangt wenige irrelevante Meldungen. Die erste
 * Fassung prüfte "irgendein Suchbegriff kommt irgendwo vor" - damit genügte
 * das Wort "Updates" in einem Artikel über eine Datenbanklücke, um ihn in einen
 * Windows-Auftrag zu holen. Zwei Ursachen:
 *
 * 1. Ein einzelner, sehr allgemeiner Begriff reichte aus.
 * 2. Die Suche traf auch mitten in Wörtern ("KB" in "Skript-KBytes").
 *
 * Beides wird hier behoben, ohne ein Thema festzuschreiben: Die Regeln sind
 * Angaben am Auftrag (Daten), diese Datei enthält nur die Auswertung. Ein
 * Wetter- oder Preisauftrag benutzt genau dieselbe Logik.
 *
 * Reine Logik ohne Netz- und Datenbankzugriff, damit vollständig testbar
 * (Modulgrenze 3 der Architektur).
 */

export interface RelevanzRegeln {
  /** Alle diese Begriffe müssen vorkommen. Leer = keine Pflicht. */
  readonly pflichtbegriffe: readonly string[];
  /** Von diesen müssen mindestens `mindestTreffer` vorkommen. */
  readonly suchbegriffe: readonly string[];
  /** Kommt einer davon vor, ist der Inhalt unabhängig von allem anderen raus. */
  readonly ausschlussbegriffe: readonly string[];
  /** Wie viele verschiedene Suchbegriffe nötig sind. Mindestens 1. */
  readonly mindestTreffer: number;
}

export interface RelevanzBefund {
  readonly relevant: boolean;
  /** Nachvollziehbare Begründung - wird am Ergebnis mitgeschrieben. */
  readonly begruendung: string;
  /** Welche Suchbegriffe getroffen haben. */
  readonly treffer: readonly string[];
}

function maskiere(begriff: string): string {
  return begriff.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trifft der Begriff am Wortanfang?
 *
 * Bewusst nur am Anfang und nicht auch am Ende: "KB" soll die Kennungen der
 * Microsoft-Artikel finden ("KB5000001"), "Update" auch "Updates". Ein Treffer
 * mitten im Wort wird dagegen ausgeschlossen - genau der Fehler von vorher.
 * Mehrwortbegriffe ("Windows 11") funktionieren unverändert, Leerraum im Text
 * darf dabei abweichen.
 */
export function begriffKommtVor(text: string, begriff: string): boolean {
  const bereinigt = begriff.trim();
  if (!bereinigt) return false;
  const muster = maskiere(bereinigt).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${muster}`, "iu").test(text);
}

/**
 * Prüft einen Inhalt gegen die Regeln seines Auftrags.
 *
 * `quelleThemenspezifisch` sagt, dass die Quelle schon auf das Thema begrenzt
 * ist (ein reines Windows-Forum, ein Feed mit Suchabfrage). Dann bürgt die
 * Herkunft für das Thema und die Pflichtbegriffe müssen nicht im Text stehen -
 * ohne diese Ausnahme fielen gerade die Frühwarnkanäle heraus, weil ein
 * Forenbeitrag selten dazuschreibt, worum es überhaupt geht. Die
 * Ausschlussbegriffe und die nötige Trefferzahl gelten weiterhin.
 */
export function pruefeRelevanz(
  titel: string,
  auszug: string,
  regeln: RelevanzRegeln,
  quelleThemenspezifisch = false,
): RelevanzBefund {
  const text = `${titel}\n${auszug}`;

  const ausgeschlossen = regeln.ausschlussbegriffe.filter((b) => begriffKommtVor(text, b));
  if (ausgeschlossen.length > 0) {
    return {
      relevant: false,
      begruendung: `Ausschlussbegriff gefunden: ${ausgeschlossen.join(", ")}`,
      treffer: [],
    };
  }

  const fehlendePflicht = quelleThemenspezifisch
    ? []
    : regeln.pflichtbegriffe.filter((b) => !begriffKommtVor(text, b));
  if (fehlendePflicht.length > 0) {
    return {
      relevant: false,
      begruendung: `Pflichtbegriff fehlt: ${fehlendePflicht.join(", ")}`,
      treffer: [],
    };
  }

  const treffer = regeln.suchbegriffe.filter((b) => begriffKommtVor(text, b));
  const noetig = Math.max(1, regeln.mindestTreffer);

  // Ein Auftrag ohne Suchbegriffe wird allein über die Pflichtbegriffe
  // gesteuert; dann ist die Trefferzahl kein Kriterium.
  if (regeln.suchbegriffe.length === 0) {
    if (quelleThemenspezifisch) {
      return { relevant: true, begruendung: "Themenspezifische Quelle", treffer: [] };
    }
    return {
      relevant: true,
      begruendung:
        regeln.pflichtbegriffe.length > 0
          ? `Alle Pflichtbegriffe vorhanden: ${regeln.pflichtbegriffe.join(", ")}`
          : "Keine Einschränkung hinterlegt",
      treffer: [],
    };
  }

  if (treffer.length < noetig) {
    return {
      relevant: false,
      begruendung:
        treffer.length === 0
          ? "Kein Suchbegriff getroffen"
          : `Nur ${treffer.length} von ${noetig} nötigen Suchbegriffen: ${treffer.join(", ")}`,
      treffer,
    };
  }

  const pflichtHinweis = quelleThemenspezifisch
    ? "; Thema durch die Quelle belegt"
    : regeln.pflichtbegriffe.length > 0
      ? "; Pflichtbegriffe erfüllt"
      : "";
  return {
    relevant: true,
    begruendung: `${treffer.length} Suchbegriffe getroffen: ${treffer.join(", ")}${pflichtHinweis}`,
    treffer,
  };
}
