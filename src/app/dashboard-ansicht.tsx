"use client";
/**
 * Dashboard-Ansicht: Quellennetz links, Bewertung rechts.
 * Zusammenspiel: Wird eine Aussage angetippt, leuchten die Quellen auf, die
 * sie belegen - so ist sofort sichtbar, worauf eine Einstufung beruht.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import type { DashboardDaten } from "@/lib/supabase-daten";

const TYP_FARBE: Record<string, string> = {
  hersteller_offiziell: "#4ADE80", status_seite: "#4ADE80", fachmedium: "#3D6DF7",
  forum: "#E8A33D", community: "#E8A33D", extern_agent: "#A78BFA", rss: "#7A899F",
};
const STUFEN_FARBE: Record<number, string> = {
  1: "#E8A33D", 2: "#E8A33D", 3: "#35C4B4", 4: "#35C4B4",
  5: "#4ADE80", 6: "#22C55E", 7: "#22C55E", 8: "#F0616D",
};
const STUFEN_NAME: Record<number, string> = {
  1: "Unbestätigter Einzelhinweis", 2: "Mehrfach beobachtet", 3: "Erkennbarer Trend",
  4: "Technisch plausibel", 5: "Unabhängig bestätigt", 6: "Offiziell bestätigt",
  7: "Behoben", 8: "Widerlegt",
};

interface Punkt extends SimulationNodeDatum {
  id: string; label: string; quellentyp: string; gewicht: number; offiziell: boolean;
}

export function DashboardAnsicht({ daten }: { daten: DashboardDaten }) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [groesse, setGroesse] = useState({ breite: 800, hoehe: 520 });

  const hervorgehoben = useMemo(() => {
    const a = daten.aussagen.find((x) => x.id === gewaehlt);
    return a ? new Set(a.herausgeber) : null;
  }, [gewaehlt, daten.aussagen]);

  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const messen = () => setGroesse({ breite: el.clientWidth, hoehe: el.clientHeight });
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  useEffect(() => {
    const knoten: Punkt[] = daten.knoten.map((k) => ({ ...k }));
    const kanten = daten.kanten.map((k) => ({ source: k.von, target: k.nach }));
    const sim = forceSimulation(knoten)
      .force("link", forceLink(kanten).id((d) => (d as Punkt).id).distance(140))
      .force("charge", forceManyBody().strength(-460))
      .force("center", forceCenter(groesse.breite / 2, groesse.hoehe / 2))
      .force("collide", forceCollide<Punkt>().radius((d) => radius(d.gewicht) + 34))
      .on("tick", () => setPunkte([...knoten]));
    return () => { sim.stop(); };
  }, [daten.knoten, daten.kanten, groesse]);

  const k = daten.kennzahlen;
  const verteilung = daten.aussagen.reduce<Record<number, number>>((acc, a) => {
    acc[a.stufe] = (acc[a.stufe] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="huelle">
      <header>
        <div className="eyebrow"><span className="puls" /> BEOBACHTUNGSAUFTRAG · AKTIV</div>
        <h1>{daten.auftrag.name}</h1>
        <p className="frage">{daten.auftrag.fragestellung}</p>
        <div className="kennzahlen">
          <span><b>{k.quellen}</b> Quellen</span>
          <span><b>{k.inhalte}</b> Beiträge</span>
          <span><b>{k.aussagen}</b> Aussagen</span>
          {k.quellenFehler > 0 && <span className="warnung">{k.quellenFehler} Quellen nicht erreichbar</span>}
          {k.letzterAbruf && <span>letzter Abruf: {new Date(k.letzterAbruf).toLocaleString("de-DE")}</span>}
        </div>
      </header>

      <div className="gitter">
        <section className="karte netz" ref={flaeche}>
          <div className="karten-kopf eyebrow">QUELLENNETZ · GRÖSSE = BEITRÄGE · LINIE = ÜBERNAHME</div>
          <svg width="100%" height="100%" role="img" aria-label="Netz der beobachteten Quellen">
            {daten.kanten.map((kante, idx) => {
              const a = punkte.find((p) => p.id === kante.von);
              const b = punkte.find((p) => p.id === kante.nach);
              if (!a || !b) return null;
              return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2A3852" strokeWidth={1.2} />;
            })}
            {punkte.map((p) => {
              const farbe = TYP_FARBE[p.quellentyp] ?? "#7A899F";
              const aktiv = !hervorgehoben || hervorgehoben.has(p.label);
              return (
                <g key={p.id} opacity={aktiv ? 1 : 0.22} style={{ transition: "opacity .25s" }}>
                  {p.offiziell && <circle cx={p.x} cy={p.y} r={radius(p.gewicht) + 9} fill="none" stroke={farbe} strokeOpacity={0.35} />}
                  <circle cx={p.x} cy={p.y} r={radius(p.gewicht)} fill={farbe} fillOpacity={0.16} stroke={farbe} strokeWidth={1.5} />
                  <text x={p.x} y={(p.y ?? 0) + 4} textAnchor="middle" className="knoten-zahl">{p.gewicht}</text>
                  <text x={p.x} y={(p.y ?? 0) + radius(p.gewicht) + 16} textAnchor="middle" className="knoten-name">{p.label}</text>
                </g>
              );
            })}
          </svg>
          <div className="legende">
            <span><i style={{ background: "#4ADE80" }} />offizielle Primärquelle</span>
            <span><i style={{ background: "#3D6DF7" }} />Fachmedium</span>
            <span><i style={{ background: "#E8A33D" }} />Community / Forum</span>
            <span><i style={{ background: "#A78BFA" }} />externer Sammler</span>
          </div>
        </section>

        <aside className="karte panel">
          <div className="eyebrow">BEWERTUNG DES INFORMATIONSGEHALTS</div>
          <div className="leiter" aria-label="Verteilung über die Reifegrad-Stufen">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <div key={s} title={`Stufe ${s} – ${STUFEN_NAME[s]}: ${verteilung[s] ?? 0}`}
                   style={{ background: verteilung[s] ? STUFEN_FARBE[s] : "#1B2437" }} />
            ))}
          </div>
          <div className="leiter-text eyebrow">
            REIFEGRAD 1–8 · {Object.entries(verteilung).map(([s, n]) => `Stufe ${s}: ${n}`).join(" / ") || "keine Aussagen"}
          </div>

          {daten.aussagen.length === 0 && (
            <p className="leer">Noch keine Aussagen erfasst. Nach dem nächsten Abruf erscheinen hier die Befunde.</p>
          )}
          {daten.aussagen.map((a) => (
            <article key={a.id} onClick={() => setGewaehlt(gewaehlt === a.id ? null : a.id)}
                     className={gewaehlt === a.id ? "aussage gewaehlt" : "aussage"}
                     tabIndex={0} role="button"
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setGewaehlt(gewaehlt === a.id ? null : a.id); }}>
              <div className="stufen-zeile">
                <span className="punkt" style={{ background: STUFEN_FARBE[a.stufe] }} />
                <span className="stufe" style={{ color: STUFEN_FARBE[a.stufe] }}>
                  STUFE {a.stufe} · {(STUFEN_NAME[a.stufe] ?? "").toUpperCase()}
                </span>
              </div>
              <p className="sachverhalt">{a.sachverhalt}</p>
              <p className="begruendung">{a.ausloeser}</p>
              <p className="belege">Belege: {a.belegAnzahl} · {a.herausgeber.join(", ")}</p>
            </article>
          ))}
        </aside>
      </div>
      <footer className="fuss">
        Diese Ansicht zeigt keine Wahrheit, sondern Belege: wer was behauptet, wie unabhängig die Quellen
        sind und wie belastbar eine Aussage derzeit ist. Antippen einer Aussage hebt ihre Quellen im Netz hervor.
      </footer>
    </main>
  );
}

function radius(gewicht: number): number {
  return 14 + Math.min(22, Math.sqrt(gewicht) * 4);
}
