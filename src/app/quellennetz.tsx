"use client";
/**
 * Das Quellennetz.
 *
 * Behebt drei Mängel der ersten Fassung:
 * - Die Knoten trieben aus der Fläche. Jetzt legt sich der Ausschnitt um die
 *   Knoten statt umgekehrt (src/lib/netz-layout.ts).
 * - Es gab keine Navigation. Jetzt: ziehen, vergrößern, zurücksetzen - mit
 *   Maus, Finger und Tastatur.
 * - Verknüpfungen waren nicht erkennbar. Jetzt sind sie beschriftet, und wenn
 *   es keine gibt, sagt die Ansicht das ausdrücklich, statt leer zu wirken.
 */
import { useMemo, useRef, useState } from "react";
import {
  alsViewBox, ordneAn, passendeAnsicht, verschobeneAnsicht,
  type NetzKante, type NetzKnoten,
} from "@/lib/netz-layout";

const TYP_FARBE: Record<string, string> = {
  hersteller_offiziell: "#4ADE80", status_seite: "#4ADE80", fachmedium: "#3D6DF7",
  forum: "#E8A33D", community: "#E8A33D", extern_agent: "#A78BFA", rss: "#7A899F",
};

const BEZIEHUNG_NAME: Record<string, string> = {
  uebernahme: "Übernahme",
  unabhaengige_bestaetigung: "unabhängige Bestätigung",
  widerspruch: "Widerspruch",
  zitat: "Zitat",
};

export function Quellennetz({
  knoten,
  kanten,
  hervorgehoben,
  aufQuelle,
}: {
  knoten: readonly NetzKnoten[];
  kanten: readonly NetzKante[];
  /** Herausgeber, die die gewählte Aussage belegen; null = keine Auswahl. */
  hervorgehoben: ReadonlySet<string> | null;
  aufQuelle: (label: string) => void;
}) {
  const [vergroesserung, setVergroesserung] = useState(1);
  const [versatz, setVersatz] = useState({ x: 0, y: 0 });
  const ziehen = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const flaeche = useRef<SVGSVGElement>(null);

  const platziert = useMemo(() => ordneAn(knoten, kanten), [knoten, kanten]);
  const grundAnsicht = useMemo(() => passendeAnsicht(platziert), [platziert]);
  const ansicht = verschobeneAnsicht(grundAnsicht, vergroesserung, versatz.x, versatz.y);

  const nachId = useMemo(
    () => new Map(platziert.map((p) => [p.id, p])),
    [platziert],
  );

  function zuruecksetzen() {
    setVergroesserung(1);
    setVersatz({ x: 0, y: 0 });
  }

  /** Ein Bildschirmpunkt entspricht so vielen Einheiten der Zeichnung. */
  function massstab(): number {
    const breitePx = flaeche.current?.clientWidth ?? 800;
    return ansicht.breite / Math.max(1, breitePx);
  }

  function beiZeigerAb(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ziehen.current = { x: e.clientX, y: e.clientY, startX: versatz.x, startY: versatz.y };
  }

  function beiZeigerBewegung(e: React.PointerEvent<SVGSVGElement>) {
    const z = ziehen.current;
    if (!z) return;
    const m = massstab();
    setVersatz({
      x: z.startX - (e.clientX - z.x) * m,
      y: z.startY - (e.clientY - z.y) * m,
    });
  }

  function beiZeigerAuf(e: React.PointerEvent<SVGSVGElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    ziehen.current = null;
  }

  function beiRad(e: React.WheelEvent<SVGSVGElement>) {
    // Kein preventDefault: In React ist onWheel passiv, der Aufruf würde nur
    // eine Warnung erzeugen. Die Begrenzung unten verhindert stattdessen,
    // dass die Ansicht unbrauchbar wird.
    setVergroesserung((v) => grenze(v * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  }

  const leer = knoten.length === 0;

  return (
    <section className="karte netz">
      <div className="karten-kopf eyebrow">
        QUELLENNETZ · GRÖSSE = BEITRÄGE · LINIE = ÜBERNAHME
      </div>

      <div className="netz-bedienung">
        <button type="button" className="netz-knopf" onClick={() => setVergroesserung((v) => grenze(v * 1.3))}
                aria-label="Vergrößern">+</button>
        <button type="button" className="netz-knopf" onClick={() => setVergroesserung((v) => grenze(v / 1.3))}
                aria-label="Verkleinern">−</button>
        <button type="button" className="netz-knopf netz-knopf-breit" onClick={zuruecksetzen}>
          Ansicht zurücksetzen
        </button>
      </div>

      {leer ? (
        <p className="netz-hinweis">
          Für diesen Auftrag sind noch keine Quellen erfasst. Lege unter
          „Verwalten“ Quellen an — danach entsteht das Netz beim ersten
          Sammellauf.
        </p>
      ) : (
        <svg
          ref={flaeche}
          className="netz-flaeche"
          viewBox={alsViewBox(ansicht)}
          role="img"
          aria-label={`Netz aus ${knoten.length} Quellen und ${kanten.length} Verknüpfungen`}
          onPointerDown={beiZeigerAb}
          onPointerMove={beiZeigerBewegung}
          onPointerUp={beiZeigerAuf}
          onPointerCancel={beiZeigerAuf}
          onWheel={beiRad}
        >
          {kanten.map((kante, idx) => {
            const a = nachId.get(kante.von);
            const b = nachId.get(kante.nach);
            if (!a || !b) return null;
            const aktiv =
              !hervorgehoben || hervorgehoben.has(a.label) || hervorgehoben.has(b.label);
            return (
              <g key={`${kante.von}-${kante.nach}-${idx}`} opacity={aktiv ? 1 : 0.15}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3D6DF7" strokeWidth={1.6}
                      strokeOpacity={0.7} />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle"
                      className="kanten-name">
                  {BEZIEHUNG_NAME[kante.art] ?? kante.art}
                </text>
              </g>
            );
          })}

          {platziert.map((p) => {
            const farbe = TYP_FARBE[p.quellentyp] ?? "#7A899F";
            const aktiv = !hervorgehoben || hervorgehoben.has(p.label);
            return (
              <g key={p.id} opacity={aktiv ? 1 : 0.22} className="netz-knoten"
                 role="button" tabIndex={0}
                 onClick={() => aufQuelle(p.label)}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") aufQuelle(p.label); }}
                 aria-label={`${p.label}, ${p.gewicht} Beiträge`}>
                {p.offiziell && (
                  <circle cx={p.x} cy={p.y} r={p.radius + 9} fill="none" stroke={farbe}
                          strokeOpacity={0.35} />
                )}
                <circle cx={p.x} cy={p.y} r={p.radius} fill={farbe} fillOpacity={0.16}
                        stroke={farbe} strokeWidth={1.5} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" className="knoten-zahl">
                  {p.gewicht}
                </text>
                <text x={p.x} y={p.y + p.radius + 17} textAnchor="middle" className="knoten-name">
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {!leer && kanten.length === 0 && (
        <p className="netz-fussnote">
          Noch keine Verknüpfungen: Bisher hat keine Meldung Belege aus mehr als
          einer Quelle. Das ist ein Befund, kein Fehler — mehrfach belegte
          Meldungen erscheinen hier als Linie.
        </p>
      )}

      <div className="legende">
        <span><i style={{ background: "#4ADE80" }} />offizielle Primärquelle</span>
        <span><i style={{ background: "#3D6DF7" }} />Fachmedium</span>
        <span><i style={{ background: "#E8A33D" }} />Community / Forum</span>
        <span><i style={{ background: "#A78BFA" }} />externer Sammler</span>
      </div>
    </section>
  );
}

function grenze(wert: number): number {
  return Math.min(6, Math.max(0.35, wert));
}
