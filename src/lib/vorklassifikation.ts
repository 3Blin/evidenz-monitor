/**
 * Deterministische Vorklassifikation.
 *
 * Zweck: Auch ohne hinterlegten KI-Schlüssel liefert das System eine
 * nachvollziehbare Grundeinordnung. Sie beruht ausschließlich auf Fakten,
 * die ohne Sprachverständnis feststellbar sind: Quellentyp, Zeitpunkt und
 * Titelähnlichkeit. Die KI-Analyse verfeinert diese Einordnung später und
 * darf sie überschreiben - der Reifegrad selbst bleibt regelbasiert.
 */
import type { Beziehung, Klassifikation } from "./reifegrad";
import { titelAehnlichkeit, AEHNLICHKEITS_SCHWELLE } from "./dedup";
import { gemeinsameKennungen, kennungen, nachweislichVerschieden } from "./kennungen";
import { gemeinsameVerweise, verweise } from "./verweise";

/**
 * Vorgabe dafür, wie weit zwei Beiträge zeitlich auseinanderliegen dürfen, um
 * allein wegen ähnlicher Titel als dieselbe Meldung zu gelten.
 *
 * Seit ADR 0015 ist das nur noch die Vorgabe: Die Triage der Fragestellung
 * bestimmt den tatsächlichen Wert je Auftrag. Eine rückblickende Frage
 * ("Wurde damals gewarnt?") braucht Jahre, eine frische Behauptung Tage.
 *
 * Grund: Wiederkehrende Vorgänge tragen wiederkehrende Titel. Ein monatlicher
 * Patchtag, ein jährlicher Bericht, eine regelmäßige Preisrunde - ohne
 * Zeitgrenze verschmelzen Jahrgänge zu einer einzigen, nie endenden Meldung.
 *
 * Ausdrücklich NICHT für Zusammenführungen über eine gemeinsame Kennung oder
 * einen gemeinsamen Verweis: Dieselbe Sicherheitslücke bleibt dieselbe
 * Sicherheitslücke, auch wenn ein halbes Jahr zwischen den Berichten liegt.
 */
export const ZEITFENSTER_TAGE = 45;

export interface VorInhalt {
  readonly inhaltId: string;
  readonly titel: string;
  readonly quellentyp: string;
  readonly herausgeber: string;
  readonly veroeffentlichtAm: Date | null;
  /** Auszug, sofern vorhanden - Kennungen stehen oft erst im Text. */
  readonly auszug?: string;
  /** Adresse des Beitrags - trennt eigene Wege von Verweisen nach außen. */
  readonly url?: string;
}

export interface Vorbefund {
  readonly inhaltId: string;
  readonly beziehung: Beziehung;
  readonly klassifikation: Klassifikation;
  readonly begruendung: string;
}

const OFFIZIELL = new Set(["hersteller_offiziell", "status_seite"]);

/**
 * Ordnet eine Gruppe zusammengehöriger Beiträge ein.
 *
 * Der früheste Beitrag gilt als Primärmeldung, alle weiteren als Übernahme.
 *
 * Die Vorgabe "Übernahme" ist die entscheidende Festlegung, und sie war in
 * der ersten Fassung verkehrt herum: Dort galt jeder Beitrag eines anderen
 * Herausgebers mit abweichendem Titel als *unabhängige Bestätigung*. Das ist
 * ein Fehlschluss. Der Beitrag ist ja gerade deshalb in dieser Gruppe, weil
 * er dieselbe Sache behandelt - dass er sie anders formuliert, belegt keine
 * eigene Recherche. Drei Portale, die dieselbe Herstellermeldung abschreiben,
 * wären so zu "drei unabhängigen Quellen" und die Aussage auf Stufe 5
 * geraten: eine Falschaussage nach dem eigenen Maßstab dieses Projekts.
 *
 * Unabhängigkeit ist eine inhaltliche Feststellung - hat diese Redaktion
 * eigene Belege beigebracht oder nur umgeschrieben? Das ist ohne
 * Sprachverständnis nicht entscheidbar und deshalb der KI-Analyse
 * vorbehalten, die diese Einordnung überschreiben darf (Vertrag:
 * ARCHITEKTUR.md). Bis dahin gilt die vorsichtige Annahme.
 *
 * Folge: Ohne KI-Analyse erreicht eine Aussage höchstens Stufe 2
 * ("mehrfach beobachtet") - es sei denn, eine offizielle Primärquelle ist
 * beteiligt. Das ist gewollt: Lieber eine Stufe zu niedrig als eine
 * Unabhängigkeit behaupten, die nie geprüft wurde.
 */
export function klassifiziereGruppe(gruppe: readonly VorInhalt[]): readonly Vorbefund[] {
  if (gruppe.length === 0) return [];
  const sortiert = [...gruppe].sort(
    (a, b) => (a.veroeffentlichtAm?.getTime() ?? 0) - (b.veroeffentlichtAm?.getTime() ?? 0),
  );
  const primaer = sortiert[0];
  if (!primaer) return [];

  return sortiert.map((inhalt, index) => {
    const klassifikation: Klassifikation = OFFIZIELL.has(inhalt.quellentyp)
      ? "offizielle_bestaetigung"
      : "stuetzt";
    if (index === 0) {
      return {
        inhaltId: inhalt.inhaltId,
        beziehung: "primaer",
        klassifikation,
        begruendung: "Früheste Veröffentlichung dieser Meldung",
      };
    }
    const gleicherHerausgeber =
      primaer.herausgeber.toLowerCase() === inhalt.herausgeber.toLowerCase();
    return {
      inhaltId: inhalt.inhaltId,
      beziehung: "uebernahme",
      klassifikation,
      begruendung: gleicherHerausgeber
        ? "Selber Herausgeber wie die Primärmeldung"
        : "Späterer Beitrag zur selben Meldung; Unabhängigkeit ist noch nicht belegt",
    };
  });
}

/** Warum zwei Beiträge in derselben Gruppe gelandet sind. */
export interface Gruppenbefund {
  readonly inhalte: readonly VorInhalt[];
  readonly begruendung: string;
}

/**
 * Gruppiert Beiträge, die dieselbe Meldung behandeln.
 *
 * Vier Regeln, in dieser Reihenfolge geprüft:
 *
 * 1. **Gemeinsame Kennung** verbindet. KB5094126 in zwei Beiträgen heißt:
 *    beide handeln von diesem Update - auch wenn die Titel nichts gemeinsam
 *    haben, und genau das ist der häufige Fall zwischen zwei Herausgebern.
 * 2. **Verschiedene Kennungen trennen.** Tragen beide eine Kennung und teilen
 *    keine, sind es verschiedene Gegenstände; die Titelähnlichkeit wird dann
 *    gar nicht erst befragt. Ohne diese Regel verschmolzen drei verschiedene
 *    Sicherheitslücken zu einer einzigen Meldung auf Stufe 6, weil ihre Titel
 *    dieselben Formelwörter tragen.
 * 3. **Gemeinsamer Verweis** verbindet. Eine Übernahme verlinkt das Original;
 *    das hängt nicht an der Formulierung.
 * 4. **Ähnlicher Titel** verbindet, aber nur innerhalb von ZEITFENSTER_TAGE.
 *    Wiederkehrende Vorgänge tragen wiederkehrende Titel.
 *
 * Geprüft wird gegen alle Mitglieder einer Gruppe und über alle Gruppen
 * hinweg die beste Passung - nicht die erste gefundene. Sonst entschiede die
 * Reihenfolge der Beiträge über das Ergebnis.
 *
 * Bewusst nicht gesenkt wurde die Ähnlichkeitsschwelle. Eine niedrigere
 * Schwelle bringt zwar mehr Verknüpfungen, aber falsche: Aus zwei
 * unabhängigen Meldungen würde eine Bestätigung, und der Reifegrad stiege
 * ohne Grund. Ein zu niedriger Reifegrad ist ein Mangel, ein zu hoher ist
 * eine Falschaussage.
 */
export function gruppiereMitBegruendung(
  inhalte: readonly VorInhalt[],
  zeitfensterTage: number = ZEITFENSTER_TAGE,
): readonly Gruppenbefund[] {
  interface Mitglied {
    readonly inhalt: VorInhalt;
    readonly kennungen: readonly string[];
    readonly verweise: readonly string[];
  }
  interface Sammler {
    readonly mitglieder: Mitglied[];
    begruendung: string;
  }
  const gruppen: Sammler[] = [];

  for (const inhalt of inhalte) {
    const text = inhalt.auszug ?? "";
    const neuling: Mitglied = {
      inhalt,
      kennungen: kennungen(inhalt.titel, text),
      verweise: verweise(text, inhalt.url),
    };

    let beste: Sammler | null = null;
    let besterWert = 0;
    let besteBegruendung = "";

    for (const gruppe of gruppen) {
      const befund = passtZurGruppe(neuling, gruppe.mitglieder, zeitfensterTage);
      if (!befund) continue;
      if (befund.wert > besterWert) {
        beste = gruppe;
        besterWert = befund.wert;
        besteBegruendung = befund.begruendung;
      }
    }

    if (beste) {
      beste.mitglieder.push(neuling);
      // Die Begründung der Gruppe nennt den Grund der ersten Zusammenführung.
      if (beste.mitglieder.length === 2) beste.begruendung = besteBegruendung;
    } else {
      gruppen.push({
        mitglieder: [neuling],
        begruendung: "Einzelmeldung ohne Entsprechung",
      });
    }
  }

  return gruppen.map((g) => ({
    inhalte: g.mitglieder.map((m) => m.inhalt),
    begruendung: g.begruendung,
  }));
}

interface Passung {
  readonly wert: number;
  readonly begruendung: string;
}

/**
 * Prüft einen Beitrag gegen eine bestehende Gruppe.
 *
 * Geprüft wird gegen **alle** Mitglieder, nicht nur gegen das erste. Vorher
 * entschied allein das zuerst eingetroffene Mitglied: Waren A und B ähnlich
 * und B und C ähnlich, A und C aber nicht, landete C nicht bei [A, B] - das
 * Ergebnis hing an der Reihenfolge der Beiträge statt an ihrem Inhalt.
 */
function passtZurGruppe(
  neuling: { readonly inhalt: VorInhalt; readonly kennungen: readonly string[]; readonly verweise: readonly string[] },
  mitglieder: readonly {
    readonly inhalt: VorInhalt; readonly kennungen: readonly string[]; readonly verweise: readonly string[];
  }[],
  zeitfensterTage: number,
): Passung | null {
  let beste: Passung | null = null;

  for (const mitglied of mitglieder) {
    // 1. Gemeinsame Kennung - das stärkste Signal, es benennt den Gegenstand.
    const geteilteKennungen = gemeinsameKennungen(neuling.kennungen, mitglied.kennungen);
    if (geteilteKennungen.length > 0) {
      return {
        wert: Number.POSITIVE_INFINITY,
        begruendung: `Gemeinsame Kennung ${geteilteKennungen.join(", ")}`,
      };
    }

    // 2. Verschiedene Kennungen schließen einander aus. Diese Prüfung steht
    //    vor der Titelähnlichkeit, weil sie sie aufhebt: Zwei Beiträge über
    //    nachweislich verschiedene Gegenstände sind nicht dieselbe Meldung,
    //    egal wie ähnlich ihre Titel klingen.
    if (nachweislichVerschieden(neuling.kennungen, mitglied.kennungen)) continue;

    // 3. Gemeinsamer Verweis auf dieselbe fremde Seite. Eine Übernahme
    //    verlinkt das Original; das hängt nicht an der Formulierung.
    const geteilteVerweise = gemeinsameVerweise(neuling.verweise, mitglied.verweise);
    const ersterVerweis = geteilteVerweise[0];
    if (ersterVerweis !== undefined) {
      return { wert: Number.POSITIVE_INFINITY, begruendung: `Gemeinsamer Verweis ${ersterVerweis}` };
    }

    // 4. Titelähnlichkeit - nur innerhalb des Zeitfensters.
    if (!imZeitfenster(neuling.inhalt.veroeffentlichtAm, mitglied.inhalt.veroeffentlichtAm, zeitfensterTage))
      continue;
    const wert = titelAehnlichkeit(mitglied.inhalt.titel, neuling.inhalt.titel);
    if (wert >= AEHNLICHKEITS_SCHWELLE && wert > (beste?.wert ?? 0)) {
      beste = { wert, begruendung: `Titelähnlichkeit ${wert.toFixed(2)}` };
    }
  }

  return beste;
}

/** Liegen zwei Zeitpunkte nah genug beieinander? Unbekannt gilt als nah. */
function imZeitfenster(a: Date | null, b: Date | null, zeitfensterTage: number): boolean {
  if (!a || !b) return true;
  const tage = Math.abs(a.getTime() - b.getTime()) / 86_400_000;
  return tage <= zeitfensterTage;
}

/** Gruppiert Beiträge, die dieselbe Meldung behandeln (ohne Begründung). */
export function gruppiere(
  inhalte: readonly VorInhalt[],
  zeitfensterTage: number = ZEITFENSTER_TAGE,
): readonly (readonly VorInhalt[])[] {
  return gruppiereMitBegruendung(inhalte, zeitfensterTage).map((g) => g.inhalte);
}
