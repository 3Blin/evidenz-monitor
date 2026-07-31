"use client";
/**
 * Die Bewertung des Informationsgehalts.
 *
 * Fassung 3 (ADR 0016). Die drei Änderungen und ihr Anlass:
 *
 * - **„Zuerst: X, TT.MM.JJJJ" steht jetzt in der zugeklappten Zeile.** Wer
 *   zuerst berichtet hat, ist die Kernfrage dieses Systems. Sie stand bisher
 *   nur aufgeklappt und auch dort nur mittelbar.
 * - **Die Leiter zeigt die Verteilung.** Acht gleich breite Balken sagten nur
 *   "hier ist überhaupt etwas". Jetzt beantworten sie die Frage, für die man
 *   hinsieht: Wo liegt das Gewicht?
 * - **Stufe 8 steht abgesetzt.** "Widerlegt" ist kein höherer Grad als
 *   "Behoben", sondern ein anderer Ausgang. Als achter Balken einer Reihe las
 *   es sich als Steigerung - bei einem System gegen Falschmeldungen die
 *   schlimmste denkbare Verwechslung.
 *
 * Gerechnet wird in aussagen-ansicht.ts, damit es prüfbar bleibt.
 */
import { useMemo, useState } from "react";
import type { DashboardDaten } from "@/lib/supabase-daten";
import {
  alterInWorten, datumInWorten, fruehesterBeleg, leiterBalken, sortiere,
  SORTIERUNG_TEXT, STUFE_WIDERLEGT, type Sortierung,
} from "@/lib/aussagen-ansicht";

const STUFEN_FARBE: Record<number, string> = {
  1: "#E8A33D", 2: "#E8A33D", 3: "#35C4B4", 4: "#35C4B4",
  5: "#4ADE80", 6: "#22C55E", 7: "#22C55E", 8: "#F0616D",
};
const STUFEN_NAME: Record<number, string> = {
  1: "Unbestätigter Einzelhinweis", 2: "Mehrfach beobachtet", 3: "Erkennbarer Trend",
  4: "Technisch plausibel", 5: "Unabhängig bestätigt", 6: "Offiziell bestätigt",
  7: "Behoben", 8: "Widerlegt",
};
const BEZIEHUNG_NAME: Record<string, string> = {
  primaer: "Erstmeldung",
  uebernahme: "Übernahme",
  unabhaengige_bestaetigung: "unabhängige Bestätigung",
  widerspruch: "Widerspruch",
  zitat: "Zitat",
};

export function AussagenListe({
  daten,
  gewaehlt,
  setGewaehlt,
  quellenFilter,
  setQuellenFilter,
}: {
  daten: DashboardDaten;
  gewaehlt: string | null;
  setGewaehlt: (id: string | null) => void;
  quellenFilter: string | null;
  setQuellenFilter: (label: string | null) => void;
}) {
  const [stufenFilter, setStufenFilter] = useState<number | null>(null);
  const [sortierung, setSortierung] = useState<Sortierung>("stufe");

  const balken = useMemo(() => leiterBalken(daten.aussagen), [daten.aussagen]);
  const widerlegt = useMemo(
    () => daten.aussagen.filter((a) => a.stufe === STUFE_WIDERLEGT).length,
    [daten.aussagen],
  );

  const sichtbar = useMemo(() => {
    const gefiltert = daten.aussagen.filter(
      (a) =>
        (stufenFilter === null || a.stufe === stufenFilter) &&
        (quellenFilter === null || a.herausgeber.includes(quellenFilter)),
    );
    return sortiere(gefiltert, sortierung);
  }, [daten.aussagen, stufenFilter, quellenFilter, sortierung]);

  function stufeUmschalten(s: number) {
    setStufenFilter(stufenFilter === s ? null : s);
  }

  return (
    <aside className="karte panel">
      <div className="panel-kopf">
        <div className="eyebrow">BEWERTUNG DES INFORMATIONSGEHALTS</div>

        <div className="leiter" aria-label="Verteilung über die Reifegrad-Stufen">
          {balken.map((b) => (
            <button
              key={b.stufe}
              type="button"
              className={stufenFilter === b.stufe ? "leiter-teil leiter-teil-aktiv" : "leiter-teil"}
              style={{
                flexGrow: b.anteil,
                background: b.anzahl ? STUFEN_FARBE[b.stufe] : "#1B2437",
              }}
              title={`Stufe ${b.stufe} – ${STUFEN_NAME[b.stufe]}: ${b.anzahl} Aussagen`}
              aria-label={`Stufe ${b.stufe}, ${STUFEN_NAME[b.stufe]}, ${b.anzahl} Aussagen`}
              aria-pressed={stufenFilter === b.stufe}
              onClick={() => stufeUmschalten(b.stufe)}
            >
              {b.anzahl > 0 && b.anteil > 9 && <span>{b.anzahl}</span>}
            </button>
          ))}
          {/* Abgesetzt, weil es keine Sprosse ist: Widerlegtes steht nicht
              über Behobenem, es steht daneben. */}
          <button
            type="button"
            className={
              stufenFilter === STUFE_WIDERLEGT
                ? "leiter-teil leiter-widerlegt leiter-teil-aktiv"
                : "leiter-teil leiter-widerlegt"
            }
            style={{ background: widerlegt ? STUFEN_FARBE[8] : "#1B2437" }}
            title={`Stufe 8 – Widerlegt: ${widerlegt} Aussagen`}
            aria-label={`Stufe 8, Widerlegt, ${widerlegt} Aussagen`}
            aria-pressed={stufenFilter === STUFE_WIDERLEGT}
            onClick={() => stufeUmschalten(STUFE_WIDERLEGT)}
          >
            {widerlegt > 0 && <span>{widerlegt}</span>}
          </button>
        </div>
        <div className="leiter-text eyebrow">
          <span>STUFE 1 → 7 · BELASTBARKEIT</span>
          <span className="leiter-text-rechts">WIDERLEGT</span>
        </div>

        <div className="filterzeile">
          <label className="sortierwahl">
            <span className="eyebrow">SORTIERT NACH</span>
            <select value={sortierung} onChange={(e) => setSortierung(e.target.value as Sortierung)}>
              {(["stufe", "neueste", "belege"] as const).map((art) => (
                <option key={art} value={art}>{SORTIERUNG_TEXT[art]}</option>
              ))}
            </select>
          </label>
          {(stufenFilter !== null || quellenFilter !== null) && (
            <button
              type="button"
              className="knopf knopf-leise knopf-klein"
              onClick={() => { setStufenFilter(null); setQuellenFilter(null); }}
            >
              Filter aufheben ({sichtbar.length}/{daten.aussagen.length})
            </button>
          )}
        </div>
      </div>

      {daten.aussagen.length === 0 && (
        <p className="leer">
          Noch keine Aussagen erfasst. Nach dem nächsten Auswertungslauf
          erscheinen hier die Befunde.
        </p>
      )}
      {daten.aussagen.length > 0 && sichtbar.length === 0 && (
        <p className="leer">Keine Aussage entspricht dem gewählten Filter.</p>
      )}

      {sichtbar.map((a) => {
        const offen = gewaehlt === a.id;
        const erster = fruehesterBeleg(a.belege);
        return (
          <article key={a.id} className={offen ? "aussage gewaehlt" : "aussage"}>
            <button
              type="button"
              className="aussage-kopf"
              aria-expanded={offen}
              onClick={() => setGewaehlt(offen ? null : a.id)}
            >
              <span className="stufen-zeile">
                <span className="punkt" style={{ background: STUFEN_FARBE[a.stufe] }} />
                <span className="stufe" style={{ color: STUFEN_FARBE[a.stufe] }}>
                  STUFE {a.stufe} · {(STUFEN_NAME[a.stufe] ?? "").toUpperCase()}
                </span>
                <span className="aussage-alter">{alterInWorten(a.seit)}</span>
                <span className="aussage-pfeil" aria-hidden="true">{offen ? "▾" : "▸"}</span>
              </span>
              <span className="sachverhalt">{a.sachverhalt}</span>
              {/* Die Kernfrage, sichtbar ohne Aufklappen. Fehlt sie, wird das
                  gesagt - eine Lücke im Datum ist eine Aussage über die Daten
                  und keine, die man wegblenden darf. */}
              <span className="erstmeldung">
                {erster ? (
                  <>
                    <b>Zuerst:</b> {erster.herausgeber} ·{" "}
                    {datumInWorten(erster.veroeffentlichtAm)}
                  </>
                ) : (
                  <>Kein Beleg trägt ein Datum — Erstmeldung nicht bestimmbar.</>
                )}
              </span>
              <span className="belege">
                {a.belegAnzahl} {a.belegAnzahl === 1 ? "Beleg" : "Belege"} ·{" "}
                {a.herausgeber.join(", ")}
              </span>
            </button>

            {offen && (
              <div className="belegliste">
                <p className="beleg-ausloeser">{a.ausloeser}</p>
                {a.belege.length === 0 ? (
                  <p className="belegliste-leer">
                    Zu dieser Aussage liegen keine Einzelbelege vor. Nach dem
                    nächsten Auswertungslauf stehen sie hier.
                  </p>
                ) : (
                  a.belege.map((b) => (
                    <div
                      key={b.inhaltId}
                      className={b.inhaltId === erster?.inhaltId ? "beleg beleg-erster" : "beleg"}
                    >
                      <div className="beleg-kopf">
                        <span className="beleg-herkunft">{b.herausgeber}</span>
                        <span className="beleg-rolle">
                          {BEZIEHUNG_NAME[b.beziehung] ?? b.beziehung}
                        </span>
                        <span className="beleg-datum">{datumInWorten(b.veroeffentlichtAm)}</span>
                      </div>
                      <a className="beleg-titel verweis" href={b.url} target="_blank"
                         rel="noopener noreferrer">
                        {b.titel}
                      </a>
                      {b.belegstelle && <p className="beleg-stelle">{b.belegstelle}</p>}
                    </div>
                  ))
                )}
                {a.kontext && <p className="beleg-kontext">{a.kontext}</p>}
              </div>
            )}
          </article>
        );
      })}
    </aside>
  );
}
