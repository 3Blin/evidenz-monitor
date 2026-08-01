"use client";
/**
 * Das Quellennetz.
 *
 * Fassung 3, im Aussehen an Graphify angelehnt. Was sich gegenüber Fassung 2
 * geändert hat und warum:
 *
 * - **Gefüllte Knoten statt Umrisse.** Ein Netz aus dünnen Ringen zerfällt
 *   optisch; gefüllte Scheiben lesen sich als Körper und tragen Größe als
 *   Aussage.
 * - **Einfärbung nach Gruppen.** Gleiche Farbe heißt: Diese Quellen berichten
 *   nachweislich über dieselben Vorgänge. Das ist die Aussage, für die es
 *   dieses Bild gibt. Wer stattdessen die Art der Quelle sehen will,
 *   schaltet um - die alte Einfärbung bleibt also erreichbar, statt ersetzt zu
 *   werden.
 * - **Beschriftete Kanten nur bei Auswahl.** Vorher stand an jeder Linie ein
 *   Wort. Bei wenigen Kanten geht das, ab einem Dutzend ist es Rauschen.
 * - **Nachbarschaft hervorheben.** Zeigt man auf einen Knoten, tritt zurück,
 *   was nicht mit ihm verbunden ist. Das beantwortet die eigentliche Frage
 *   ("wer bestätigt wen?") in einer Bewegung.
 *
 * Fassung 4 nach einem zweiten Vorbild (ADR 0017): Der Name steht in einem
 * gerahmten Feld unter dem Knoten statt als nackter Text, die Linien sind
 * dünner und zurückhaltender, und Widerspruch ist rot. Das gerahmte Feld ist
 * nicht nur Zierde - auf einem Raster im Hintergrund ist freistehender Text
 * schwer zu lesen, und am Telefon ist genau das der Unterschied.
 *
 * Was ausdrücklich NICHT geändert wurde: die Anordnung. Sie bleibt
 * deterministisch (netz-layout.ts) - gleiche Daten, gleiches Bild. Eine
 * Kräftesimulation sähe lebendiger aus, aber ein Netz, das bei jedem Laden
 * anders aussieht, kann man nicht wiedererkennen und niemandem zeigen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  alsViewBox, feldBreite, felderPassen, gekuerzt, gruppenNummern, kantenMitte, kantenPfad,
  OHNE_GRUPPE, ordneAn, passendeAnsicht, verschobeneAnsicht, type NetzKante, type NetzKnoten,
} from "@/lib/netz-layout";

/** Einfärbung nach Art der Quelle - die Bedeutung aus dem Reifegrad. */
const TYP_FARBE: Record<string, string> = {
  hersteller_offiziell: "#4ADE80", status_seite: "#4ADE80", fachmedium: "#3D6DF7",
  forum: "#E8A33D", community: "#E8A33D", extern_agent: "#A78BFA", rss: "#7A899F",
};

/**
 * Einfärbung nach Gruppen.
 *
 * Der Reihe nach vergeben, nicht berechnet: Benachbarte Farbtöne wären bei
 * nebeneinanderliegenden Gruppen nicht auseinanderzuhalten. Diese sechs sind
 * gegeneinander unterscheidbar und auf dunklem Grund alle gleich hell - sonst
 * wirkte eine Gruppe wichtiger als die andere.
 */
const GRUPPEN_FARBEN = [
  "#5B8DEF", "#4ADE80", "#E8A33D", "#A78BFA", "#35C4B4", "#F0616D",
] as const;

/**
 * Farbe für Quellen ohne jede Verknüpfung.
 *
 * Absichtlich unbunt: Sie bilden keine Gruppe, sie stehen allein. Vier
 * Einzelgänger in vier Farben sahen aus wie vier Befunde und übertönten die
 * eine Gruppe, um die es geht.
 */
const OHNE_GRUPPE_FARBE = "#55637A";

/**
 * Widerspruch ist rot, alles andere trägt die Farbe seiner Gruppe.
 *
 * Der einzige Fall, in dem eine Kante etwas anderes bedeutet als "dieselbe
 * Meldung": Hier sagt eine Quelle das Gegenteil der anderen. Das in derselben
 * Farbe zu zeichnen wie eine Bestätigung wäre irreführend.
 */
const WIDERSPRUCH_FARBE = "#F0616D";

const BEZIEHUNG_NAME: Record<string, string> = {
  uebernahme: "Übernahme",
  unabhaengige_bestaetigung: "unabhängige Bestätigung",
  widerspruch: "Widerspruch",
  zitat: "Zitat",
};

type Faerbung = "gruppen" | "typ";

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
  const [faerbung, setFaerbung] = useState<Faerbung>("gruppen");
  const [beruehrt, setBeruehrt] = useState<string | null>(null);
  const ziehen = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const gezogen = useRef(false);
  const flaeche = useRef<SVGSVGElement>(null);

  /**
   * Seitenverhältnis der Zeichenfläche, gemessen statt geraten.
   *
   * Nur damit lässt sich der Leerraum an den Rändern vermeiden: Eine
   * SVG-Zeichnung passt ihren Ausschnitt ein und lässt an zwei Seiten Platz,
   * wenn die Verhältnisse nicht übereinstimmen. Wie breit die Karte ist, hängt
   * am Fenster - das kann der Server nicht wissen. Der Anfangswert entspricht
   * der Karte auf einem gewöhnlichen Bildschirm, damit vor der ersten Messung
   * nichts springt.
   */
  const [flaechenGroesse, setFlaechenGroesse] = useState({ breite: 900, hoehe: 530 });
  const verhaeltnis = flaechenGroesse.breite / Math.max(1, flaechenGroesse.hoehe);

  useEffect(() => {
    const el = flaeche.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const beobachter = new ResizeObserver(([eintrag]) => {
      const kasten = eintrag?.contentRect;
      if (!kasten || kasten.height <= 0 || kasten.width <= 0) return;
      setFlaechenGroesse({ breite: kasten.width, hoehe: kasten.height });
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  const platziert = useMemo(
    () => ordneAn(knoten, kanten, verhaeltnis),
    [knoten, kanten, verhaeltnis],
  );
  const grundAnsicht = useMemo(
    () => passendeAnsicht(platziert, undefined, verhaeltnis),
    [platziert, verhaeltnis],
  );
  const ansicht = verschobeneAnsicht(grundAnsicht, vergroesserung, versatz.x, versatz.y);

  /**
   * Wie viele Zeichnungseinheiten auf einen Bildschirmpunkt kommen.
   *
   * Schrift in einer SVG-Zeichnung wird mit dem Ausschnitt mitskaliert. Eine
   * feste Größe in Zeichnungseinheiten heißt deshalb: am großen Bildschirm
   * lesbar, am Telefon winzig - und beim Hineinzoomen riesig. Multipliziert man
   * sie mit diesem Maßstab, bleibt sie auf dem Bildschirm überall gleich groß.
   */
  const skala = ansicht.breite / Math.max(1, flaechenGroesse.breite);
  const gruppen = useMemo(() => gruppenNummern(knoten, kanten), [knoten, kanten]);

  const nachId = useMemo(() => new Map(platziert.map((p) => [p.id, p])), [platziert]);

  /** Wer hängt mit wem zusammen - für das Hervorheben der Nachbarschaft. */
  const nachbarn = useMemo(() => {
    const karte = new Map<string, Set<string>>();
    for (const k of knoten) karte.set(k.id, new Set([k.id]));
    for (const kante of kanten) {
      karte.get(kante.von)?.add(kante.nach);
      karte.get(kante.nach)?.add(kante.von);
    }
    return karte;
  }, [knoten, kanten]);

  function farbe(p: { id: string; quellentyp: string }): string {
    if (faerbung === "typ") return TYP_FARBE[p.quellentyp] ?? "#7A899F";
    const nummer = gruppen.get(p.id) ?? OHNE_GRUPPE;
    if (nummer === OHNE_GRUPPE) return OHNE_GRUPPE_FARBE;
    return GRUPPEN_FARBEN[nummer % GRUPPEN_FARBEN.length] ?? "#5B8DEF";
  }

  /**
   * Wie deutlich ein Knoten gezeigt wird: 1 voll, darunter zurückgetreten.
   *
   * Zwei Quellen der Zurücknahme, die einander nicht überschreiben dürfen: die
   * gewählte Aussage in der Liste daneben (hervorgehoben) und der Zeiger auf
   * einem Knoten (beruehrt). Es gilt die jeweils strengere.
   */
  function staerke(id: string, label: string): number {
    let wert = 1;
    if (hervorgehoben && !hervorgehoben.has(label)) wert = 0.18;
    if (beruehrt && !nachbarn.get(beruehrt)?.has(id)) wert = Math.min(wert, 0.12);
    return wert;
  }

  function kantenStaerke(kante: NetzKante, aLabel: string, bLabel: string): number {
    let wert = 1;
    if (hervorgehoben && !hervorgehoben.has(aLabel) && !hervorgehoben.has(bLabel)) wert = 0.12;
    if (beruehrt && kante.von !== beruehrt && kante.nach !== beruehrt) wert = Math.min(wert, 0.08);
    return wert;
  }

  function zuruecksetzen() {
    setVergroesserung(1);
    setVersatz({ x: 0, y: 0 });
  }

  /** Ein Bildschirmpunkt entspricht so vielen Einheiten der Zeichnung. */
  function massstab(): number {
    return skala;
  }

  function beiZeigerAb(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ziehen.current = { x: e.clientX, y: e.clientY, startX: versatz.x, startY: versatz.y };
    gezogen.current = false;
  }

  function beiZeigerBewegung(e: React.PointerEvent<SVGSVGElement>) {
    const z = ziehen.current;
    if (!z) return;
    const m = massstab();
    // Erst ab ein paar Punkten gilt es als Ziehen. Ohne diese Schwelle zählte
    // jedes Wackeln beim Klicken als Verschieben, und der Knoten reagierte nicht.
    if (Math.abs(e.clientX - z.x) + Math.abs(e.clientY - z.y) > 4) gezogen.current = true;
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
  /**
   * Namen an jedem Knoten oder nur am berührten?
   *
   * Zwei Gründe, sie zurückzuhalten: zu viele Knoten (Textwand) oder zu wenig
   * Platz nebeneinander (die Felder überdecken sich). Der zweite Fall wird
   * gerechnet und nicht an einer geratenen Bildschirmbreite festgemacht - am
   * Telefon ist genau das der Unterschied zwischen lesbar und Balkensalat.
   * Die Zahl im Knoten bleibt ohnehin immer sichtbar.
   */
  const namenImmer = platziert.length <= 14 && felderPassen(platziert, skala);

  return (
    <section className="karte netz">
      {/* Überschrift und Bedienung in einer Zeile, die umbrechen darf. Vorher
          lagen beide frei über der Zeichnung - bei mittleren Breiten schob sich
          die Bedienung dann über den Text. Im normalen Fluss kann das nicht
          passieren, bei keiner Bildschirmbreite. */}
      <div className="netz-leiste">
      <div className="karten-kopf eyebrow">
        QUELLENNETZ · GRÖSSE = BEITRÄGE · LINIE = GEMEINSAME MELDUNG
      </div>

      <div className="netz-bedienung">
        <div className="netz-umschalter" role="group" aria-label="Einfärbung">
          <button type="button" className={faerbung === "gruppen" ? "an" : ""}
                  onClick={() => setFaerbung("gruppen")}>Gruppen</button>
          <button type="button" className={faerbung === "typ" ? "an" : ""}
                  onClick={() => setFaerbung("typ")}>Art</button>
        </div>
        <button type="button" className="netz-knopf" onClick={() => setVergroesserung((v) => grenze(v * 1.3))}
                aria-label="Vergrößern">+</button>
        <button type="button" className="netz-knopf" onClick={() => setVergroesserung((v) => grenze(v / 1.3))}
                aria-label="Verkleinern">−</button>
        <button type="button" className="netz-knopf netz-knopf-breit" onClick={zuruecksetzen}>
          Zurücksetzen
        </button>
      </div>
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
          onPointerLeave={() => setBeruehrt(null)}
          onWheel={beiRad}
        >
          <defs>
            {/* Der weiche Schein hebt die Knoten vom Raster im Hintergrund ab.
                Ohne ihn verschwimmen dunkle Kreise mit den Rasterlinien. */}
            <filter id="netz-schein" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" result="unscharf" />
              <feMerge>
                <feMergeNode in="unscharf" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {kanten.map((kante, idx) => {
            const a = nachId.get(kante.von);
            const b = nachId.get(kante.nach);
            if (!a || !b) return null;
            const deutlich = kantenStaerke(kante, a.label, b.label);
            // Die Kante trägt die Farbe ihrer Gruppe - dieselbe wie ihre
            // beiden Enden, weil eine Kante immer innerhalb einer Gruppe liegt.
            const strich =
              kante.art === "widerspruch"
                ? WIDERSPRUCH_FARBE
                : faerbung === "gruppen"
                  ? farbe(a)
                  : "#3D6DF7";
            const imBlickKante = beruehrt !== null || hervorgehoben !== null;
            const zeigeNamen = deutlich === 1 && imBlickKante;
            const mitte = kantenMitte(a.x, a.y, b.x, b.y);
            return (
              <g key={`${kante.von}-${kante.nach}-${idx}`} opacity={deutlich}>
                <path d={kantenPfad(a.x, a.y, b.x, b.y)} fill="none" stroke={strich}
                      strokeWidth={(deutlich === 1 ? 1.4 : 1) * skala} strokeOpacity={imBlickKante ? 0.75 : 0.4}
                      strokeLinecap="round" />
                {zeigeNamen && (
                  <text x={mitte.x} y={mitte.y - 6 * skala} textAnchor="middle"
                        className="kanten-name" fontSize={10 * skala}>
                    {BEZIEHUNG_NAME[kante.art] ?? kante.art}
                  </text>
                )}
              </g>
            );
          })}

          {platziert.map((p) => {
            const f = farbe(p);
            const deutlich = staerke(p.id, p.label);
            const imBlick = deutlich === 1;
            return (
              <g key={p.id} opacity={deutlich} className="netz-knoten"
                 role="button" tabIndex={0}
                 onPointerEnter={() => setBeruehrt(p.id)}
                 onFocus={() => setBeruehrt(p.id)}
                 onBlur={() => setBeruehrt(null)}
                 onClick={() => { if (!gezogen.current) aufQuelle(p.label); }}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") aufQuelle(p.label); }}
                 aria-label={`${p.label}, ${p.gewicht} Beiträge`}>
                {/* Offizielle Primärquellen behalten ihren Ring, auch wenn nach
                    Gruppen eingefärbt wird. Ob eine Aussage von offizieller
                    Stelle kommt, ist zu wichtig, um es hinter einer
                    Farbeinstellung zu verstecken. */}
                {p.offiziell && (
                  <circle cx={p.x} cy={p.y} r={p.radius + 7 * skala} fill="none" stroke="#4ADE80"
                          strokeWidth={1.2 * skala} strokeOpacity={imBlick ? 0.7 : 0.3} />
                )}
                <circle cx={p.x} cy={p.y} r={p.radius} fill={f}
                        fillOpacity={imBlick ? 0.92 : 0.75}
                        stroke={f} strokeWidth={beruehrt === p.id ? 3 * skala : 0}
                        strokeOpacity={0.45}
                        filter={imBlick ? "url(#netz-schein)" : undefined} />
                <text x={p.x} y={p.y + 4 * skala} textAnchor="middle" className="knoten-zahl"
                      fontSize={12 * skala}>
                  {p.gewicht}
                </text>
                {(namenImmer || beruehrt === p.id) && (() => {
                  // Gerahmtes Feld statt freistehendem Text: Der Hintergrund
                  // trägt ein Raster, auf dem heller Text schwer zu lesen ist.
                  const name = gekuerzt(p.label);
                  const breite = feldBreite(name) * skala;
                  const hoehe = 20 * skala;
                  const oben = p.y + p.radius + 10 * skala;
                  return (
                    <g className="knoten-feld">
                      <rect x={p.x - breite / 2} y={oben} width={breite} height={hoehe}
                            rx={6 * skala} fill="var(--flaeche-hell)" stroke={f}
                            strokeOpacity={beruehrt === p.id ? 0.8 : 0.35} strokeWidth={skala} />
                      <text x={p.x} y={oben + 14 * skala} textAnchor="middle" className="knoten-name"
                            fontSize={11 * skala}>
                        {name}
                      </text>
                    </g>
                  );
                })()}
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
        {faerbung === "gruppen" ? (
          <>
            <span className="legende-satz">
              Gleiche Farbe = über gemeinsame Meldungen verbunden.
            </span>
            <span><i style={{ background: OHNE_GRUPPE_FARBE }} />ohne Verknüpfung</span>
            <span><i className="legende-ring" />offizielle Primärquelle</span>
          </>
        ) : (
          <>
            <span><i style={{ background: "#4ADE80" }} />offizielle Primärquelle</span>
            <span><i style={{ background: "#3D6DF7" }} />Fachmedium</span>
            <span><i style={{ background: "#E8A33D" }} />Community / Forum</span>
            <span><i style={{ background: "#A78BFA" }} />externer Sammler</span>
          </>
        )}
      </div>
    </section>
  );
}

function grenze(wert: number): number {
  return Math.min(6, Math.max(0.35, wert));
}
