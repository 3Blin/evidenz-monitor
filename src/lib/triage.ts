/**
 * Triage der Fragestellung (ADR 0015).
 *
 * Zweck: Herausfinden, worauf eine Frage zielt, und daraus die Betriebsart
 * ableiten. Denn dieselbe Maschinerie muss sehr verschiedene Aufgaben bedienen:
 *
 * - "Ich habe eben gehört, dass …" — Gibt es dazu überhaupt schon etwas im
 *   Netz? Und dann: beobachten. Tauchen plötzlich weitere Meldungen auf? Wird
 *   abgeschrieben, oder kommt tatsächlich Neues hinzu?
 * - "Wie entwickelt sich …" — laufende Beobachtung über Wochen.
 * - "Wurde damals wirklich …" — eine Vielzahl alter und neuer Äußerungen
 *   gegenüberstellen. Hier hilft häufiges Abrufen gar nichts; hier zählt, wie
 *   weit zurück verglichen wird.
 *
 * Ohne diese Unterscheidung bekämen alle drei denselben Takt und dasselbe
 * Zeitfenster - und wären damit alle drei falsch bedient.
 *
 * Themenneutralität (verbindliche Anforderung): Die Merkmale unten sind reine
 * Sprachmerkmale - Zeitbezüge und Redewendungen. Kein einziges nennt ein Thema,
 * eine Firma oder ein Produkt. Wer diese Datei liest, kann nicht erraten,
 * worüber dieses System wacht.
 *
 * Ohne Sprachmodell: Diese Einordnung ist bewusst regelbasiert und läuft ohne
 * Schlüssel und ohne Kosten. Sie ist ein *Vorschlag* an die Nutzerin, kein
 * Urteil; sie kann alles überstimmen. Eine KI kann die Einordnung später
 * verfeinern - sie ersetzt sie nicht, denn eine unerklärliche Betriebsart wäre
 * schlimmer als eine grobe.
 */
import { GROESSTER_TAKT_MINUTEN, KLEINSTER_TAKT_MINUTEN } from "./taktung";

export type Betriebsart = "akut" | "laufend" | "historisch";

export interface Triagebefund {
  readonly betriebsart: Betriebsart;
  /** Warum diese Betriebsart - im Klartext, für die Oberfläche. */
  readonly begruendung: string;
  /** Was die Betriebsart praktisch bedeutet. */
  readonly hinweis: string;
  /** Wie weit zurück verglichen wird (Tage). */
  readonly zeitfensterTage: number;
  readonly taktMinMinuten: number;
  readonly taktMaxMinuten: number;
  /** Welche Merkmale angesprochen haben - damit der Vorschlag prüfbar ist. */
  readonly merkmale: readonly string[];
}

/**
 * Merkmale für eine frische, noch ungeprüfte Behauptung.
 *
 * Gemeinsam ist ihnen, dass die Nutzerin selbst signalisiert, die Sache sei
 * eben erst aufgekommen - und genau dann ist die erste Frage nicht "stimmt
 * das?", sondern "gibt es das überhaupt schon irgendwo?".
 */
export const AKUT_MERKMALE: readonly RegExp[] = [
  /\beben (geh[oö]rt|gelesen|gesehen)\b/i,
  /\bgerade (eben|geh[oö]rt|gelesen|gesehen)\b/i,
  /\bsoeben\b/i,
  /\bvorhin\b/i,
  /\bheute (fr[uü]h|morgen|mittag|abend)?\b/i,
  /\bseit heute\b/i,
  /\bger[uü]cht/i,
  /\bangeblich\b/i,
  /\bes hei[sß]t,?\b/i,
  /\bh[oö]rensagen\b/i,
  /\bstimmt es,? dass\b/i,
  /\bkursiert\b/i,
  /\beilmeldung\b/i,
  /\bbreaking\b/i,
  /\bgerade erst\b/i,
];

/**
 * Merkmale für eine Frage, die zurückblickt.
 *
 * Nicht "alt" im Sinne von uninteressant, sondern: Die Antwort liegt in
 * bereits vorhandenen Äußerungen, nicht in solchen, die erst noch kommen.
 */
export const HISTORISCH_MERKMALE: readonly RegExp[] = [
  /\bdamals\b/i,
  /\bseinerzeit\b/i,
  /\bhistorisch/i,
  /\bfr[uü]her/i,
  /\bin der vergangenheit\b/i,
  /\bseit wann\b/i,
  /\bwann wurde\b/i,
  /\bwer war der erste\b/i,
  /\burspr[uü]nglich/i,
  /\bjemals\b/i,
  /\bim laufe der jahre\b/i,
];

/**
 * Jahreszahlen zählen nur mit Begleitwort.
 *
 * Grund, an dem es sich zeigt: Manche Produktfassungen tragen Bezeichnungen,
 * die wie Jahreszahlen aussehen. "1809" ist dort eine Version und kein Jahr.
 * Ein nacktes Vierstelliges als Beleg für eine historische Frage zu nehmen,
 * hieße, halbe Auftragslisten in die falsche Betriebsart zu schicken.
 */
const JAHR_MIT_BEGLEITWORT =
  /\b(?:seit|im jahre?|aus dem jahre?|anno|vor dem jahr|bis)\s+(\d{4})\b/gi;
const JAHRZEHNT = /\b(\d{4})ern?\b/gi;

/** Ab wie vielen Jahren Abstand eine Jahreszahl als "zurückblickend" gilt. */
export const HISTORISCH_AB_JAHREN = 3;

/** Zeitfenster und Taktbereich je Betriebsart. */
const EINSTELLUNG: Record<
  Betriebsart,
  { zeitfensterTage: number; taktMin: number; taktMax: number; hinweis: string }
> = {
  akut: {
    // Kurz: Bei einer frischen Behauptung ist alles Ältere als zwei Wochen
    // nicht dieselbe Meldung, sondern ein anderer Vorgang.
    zeitfensterTage: 14,
    taktMin: 15,
    taktMax: 240,
    hinweis:
      "Häufiges Nachsehen, kurzer Rückblick. Gesucht wird zuerst, ob es die Behauptung " +
      "überhaupt schon gibt — und danach, ob weitere Meldungen auftauchen, ob abgeschrieben " +
      "wird oder ob tatsächlich Neues hinzukommt.",
  },
  laufend: {
    // Gleichlautend mit ZEITFENSTER_TAGE aus vorklassifikation.ts. Bewusst
    // wiederholt statt importiert: Diese Datei läuft auch im Browser, und
    // ein Import zöge die gesamte Zusammenführungslogik ins Auslieferpaket.
    // Dass beide Werte übereinstimmen, prüft ein Test.
    zeitfensterTage: 45,
    taktMin: 60,
    taktMax: 1440,
    hinweis:
      "Regelmäßiges Nachsehen über Wochen. Der Takt zieht sich zusammen, wenn etwas " +
      "passiert, und weitet sich, wenn nichts kommt.",
  },
  historisch: {
    // Zehn Jahre: Bei einer zurückblickenden Frage ist der weite Rückblick der
    // ganze Zweck. Zwei Äußerungen zu derselben Sache dürfen Jahre
    // auseinanderliegen.
    zeitfensterTage: 3650,
    taktMin: 1440,
    taktMax: GROESSTER_TAKT_MINUTEN,
    hinweis:
      "Seltenes Nachsehen, weiter Rückblick. Häufiges Abrufen bringt hier nichts — was " +
      "zählt, ist das Gegenüberstellen von Äußerungen aus verschiedenen Zeiten.",
  },
};

function trefferSammeln(text: string, merkmale: readonly RegExp[]): string[] {
  const gefunden: string[] = [];
  for (const muster of merkmale) {
    const treffer = muster.exec(text);
    if (treffer?.[0]) gefunden.push(treffer[0].trim().toLowerCase());
  }
  return gefunden;
}

/** Findet Jahreszahlen mit Begleitwort, die weit genug zurückliegen. */
export function zurueckliegendeJahre(text: string, heute: Date = new Date()): number[] {
  const grenze = heute.getUTCFullYear() - HISTORISCH_AB_JAHREN;
  const jahre: number[] = [];
  for (const muster of [JAHR_MIT_BEGLEITWORT, JAHRZEHNT]) {
    // Eigene Kopie, weil das g-Flag den Suchzeiger über Aufrufe hinweg mitführt
    // - sonst überspringt der zweite Aufruf Treffer am Anfang des Textes.
    const eigen = new RegExp(muster.source, muster.flags);
    for (const treffer of text.matchAll(eigen)) {
      const jahr = Number.parseInt(treffer[1] ?? "", 10);
      if (jahr >= 1500 && jahr <= grenze) jahre.push(jahr);
    }
  }
  return [...new Set(jahre)].sort((a, b) => a - b);
}

/**
 * Ordnet eine Fragestellung einer Betriebsart zu.
 *
 * Zusammentreffen beider Merkmalsarten ist kein Widerspruch, sondern ein
 * eigener, häufiger Fall: "Ich habe eben gehört, dass es schon in den 1970ern
 * …". Frisch ist die *Behauptung*, alt ist der *Gegenstand*. Dann gilt der
 * enge Takt (die Behauptung ist frisch und will beobachtet werden) zusammen
 * mit dem weiten Rückblick (der Gegenstand liegt zurück). Sich für eines von
 * beiden zu entscheiden, hieße die halbe Frage wegzuwerfen.
 */
export function triage(
  fragestellung: string,
  zielbeschreibung = "",
  heute: Date = new Date(),
): Triagebefund {
  const text = `${fragestellung}\n${zielbeschreibung}`;

  const akut = trefferSammeln(text, AKUT_MERKMALE);
  const historischWorte = trefferSammeln(text, HISTORISCH_MERKMALE);
  const jahre = zurueckliegendeJahre(text, heute);
  const historisch = [...historischWorte, ...jahre.map((j) => String(j))];

  if (akut.length > 0) {
    const grundlage = EINSTELLUNG.akut;
    // Der weite Rückblick gewinnt, wenn der Gegenstand zurückliegt - der enge
    // Takt bleibt trotzdem, weil die Behauptung frisch ist.
    const zeitfensterTage =
      historisch.length > 0 ? EINSTELLUNG.historisch.zeitfensterTage : grundlage.zeitfensterTage;
    return {
      betriebsart: "akut",
      begruendung:
        historisch.length > 0
          ? `Frische Behauptung über einen zurückliegenden Gegenstand (${akut.join(", ")} — ` +
            `dazu ${historisch.join(", ")}). Eng getaktet, aber mit weitem Rückblick.`
          : `Frische, noch ungeprüfte Behauptung (${akut.join(", ")}).`,
      hinweis: grundlage.hinweis,
      zeitfensterTage,
      taktMinMinuten: grundlage.taktMin,
      taktMaxMinuten: grundlage.taktMax,
      merkmale: [...akut, ...historisch],
    };
  }

  if (historisch.length > 0) {
    const grundlage = EINSTELLUNG.historisch;
    return {
      betriebsart: "historisch",
      begruendung: `Zurückblickende Frage (${historisch.join(", ")}).`,
      hinweis: grundlage.hinweis,
      zeitfensterTage: grundlage.zeitfensterTage,
      taktMinMinuten: grundlage.taktMin,
      taktMaxMinuten: grundlage.taktMax,
      merkmale: historisch,
    };
  }

  const grundlage = EINSTELLUNG.laufend;
  return {
    betriebsart: "laufend",
    begruendung:
      "Kein Hinweis auf besondere Eile und keiner auf einen Rückblick — laufende " +
      "Beobachtung als Vorgabe.",
    hinweis: grundlage.hinweis,
    zeitfensterTage: grundlage.zeitfensterTage,
    taktMinMinuten: grundlage.taktMin,
    taktMaxMinuten: grundlage.taktMax,
    merkmale: [],
  };
}

/** Klartext für die Oberfläche. */
export const BETRIEBSART_TEXT: Record<Betriebsart, string> = {
  akut: "Frische Behauptung",
  laufend: "Laufende Beobachtung",
  historisch: "Rückblick",
};

/** Sicherheitsnetz: Die Vorschläge dürfen die harten Grenzen nie verlassen. */
export function taktVorschlagGueltig(befund: Triagebefund): boolean {
  return (
    befund.taktMinMinuten >= KLEINSTER_TAKT_MINUTEN &&
    befund.taktMaxMinuten <= GROESSTER_TAKT_MINUTEN &&
    befund.taktMaxMinuten >= befund.taktMinMinuten
  );
}
