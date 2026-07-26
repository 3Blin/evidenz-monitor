"use client";
/**
 * Die Bewertung des Informationsgehalts.
 *
 * Behebt die Rückmeldung „man kann die Punkte anklicken, es passiert aber
 * nichts" und „die Infos sind sehr dünn": Ein Klick klappt die Belege auf -
 * mit Herausgeber, Datum, Fundstelle und Verweis auf den Beitrag. Erst damit
 * löst die Ansicht ihr Versprechen ein, Belege zu zeigen statt Behauptungen.
 */
import { useMemo, useState } from "react";
import type { DashboardDaten } from "@/lib/supabase-daten";

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

  const verteilung = useMemo(
    () =>
      daten.aussagen.reduce<Record<number, number>>((acc, a) => {
        acc[a.stufe] = (acc[a.stufe] ?? 0) + 1;
        return acc;
      }, {}),
    [daten.aussagen],
  );

  const sichtbar = useMemo(
    () =>
      daten.aussagen.filter(
        (a) =>
          (stufenFilter === null || a.stufe === stufenFilter) &&
          (quellenFilter === null || a.herausgeber.includes(quellenFilter)),
      ),
    [daten.aussagen, stufenFilter, quellenFilter],
  );

  return (
    <aside className="karte panel">
      <div className="eyebrow">BEWERTUNG DES INFORMATIONSGEHALTS</div>

      <div className="leiter" aria-label="Verteilung über die Reifegrad-Stufen">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
          <button
            key={s}
            type="button"
            className={stufenFilter === s ? "leiter-teil leiter-teil-aktiv" : "leiter-teil"}
            style={{ background: verteilung[s] ? STUFEN_FARBE[s] : "#1B2437" }}
            title={`Stufe ${s} – ${STUFEN_NAME[s]}: ${verteilung[s] ?? 0} Aussagen`}
            aria-label={`Stufe ${s}, ${STUFEN_NAME[s]}, ${verteilung[s] ?? 0} Aussagen`}
            aria-pressed={stufenFilter === s}
            onClick={() => setStufenFilter(stufenFilter === s ? null : s)}
          />
        ))}
      </div>
      <div className="leiter-text eyebrow">
        REIFEGRAD 1–8 ·{" "}
        {Object.entries(verteilung).map(([s, n]) => `Stufe ${s}: ${n}`).join(" / ") ||
          "keine Aussagen"}
      </div>

      {(stufenFilter !== null || quellenFilter !== null) && (
        <div className="filterzeile">
          <span>
            Gefiltert
            {stufenFilter !== null && ` · Stufe ${stufenFilter}`}
            {quellenFilter !== null && ` · ${quellenFilter}`}
            {` · ${sichtbar.length} von ${daten.aussagen.length}`}
          </span>
          <button
            type="button"
            className="knopf knopf-leise knopf-klein"
            onClick={() => { setStufenFilter(null); setQuellenFilter(null); }}
          >
            Filter aufheben
          </button>
        </div>
      )}

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
                <span className="aussage-alter">{alter(a.seit)}</span>
                <span className="aussage-pfeil" aria-hidden="true">{offen ? "▾" : "▸"}</span>
              </span>
              <span className="sachverhalt">{a.sachverhalt}</span>
              <span className="begruendung">{a.ausloeser}</span>
              <span className="belege">
                {a.belegAnzahl} {a.belegAnzahl === 1 ? "Beleg" : "Belege"} ·{" "}
                {a.herausgeber.join(", ")}
              </span>
            </button>

            {offen && (
              <div className="belegliste">
                {a.belege.length === 0 ? (
                  <p className="belegliste-leer">
                    Zu dieser Aussage liegen keine Einzelbelege vor. Nach dem
                    nächsten Auswertungslauf stehen sie hier.
                  </p>
                ) : (
                  a.belege.map((b) => (
                    <div key={b.inhaltId} className="beleg">
                      <div className="beleg-kopf">
                        <span className="beleg-herkunft">{b.herausgeber}</span>
                        <span className="beleg-rolle">
                          {BEZIEHUNG_NAME[b.beziehung] ?? b.beziehung}
                        </span>
                        <span className="beleg-datum">{datum(b.veroeffentlichtAm)}</span>
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

/** Datum ohne Uhrzeit - die Stunde einer Meldung hilft beim Lesen nicht. */
function datum(wert: string | null): string {
  if (!wert) return "ohne Datum";
  const d = new Date(wert);
  return Number.isNaN(d.getTime())
    ? "ohne Datum"
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Alter in Worten. Die Rückmeldung nannte ausdrücklich das fehlende Alter -
 * bei einer Frühwarnung ist es die wichtigste Angabe überhaupt.
 */
function alter(wert: string | null): string {
  if (!wert) return "";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "";
  const tage = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (tage < 0) return "neu";
  if (tage === 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 31) return `vor ${tage} Tagen`;
  const monate = Math.floor(tage / 30);
  return monate < 12 ? `vor ${monate} Monaten` : `vor über einem Jahr`;
}
