"use client";
/**
 * Dashboard-Ansicht: Quellennetz links, Bewertung rechts.
 *
 * Zusammenspiel in beide Richtungen: Eine angetippte Aussage hebt die Quellen
 * hervor, die sie belegen; eine angetippte Quelle zeigt nur die Aussagen, an
 * denen sie beteiligt ist. Vorher war nur die erste Richtung vorgesehen - und
 * sie blieb unsichtbar, weil die Knoten außerhalb der Fläche lagen.
 */
import { useMemo, useState } from "react";
import type { DashboardDaten } from "@/lib/supabase-daten";
import { Quellennetz } from "./quellennetz";
import { AussagenListe } from "./aussagen-liste";

export function DashboardAnsicht({
  daten,
  kopf,
}: {
  daten: DashboardDaten;
  /** Auftragsauswahl und Anmeldezustand, von der Seite hereingegeben. */
  kopf?: React.ReactNode;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [quellenFilter, setQuellenFilter] = useState<string | null>(null);

  const hervorgehoben = useMemo(() => {
    const a = daten.aussagen.find((x) => x.id === gewaehlt);
    if (a) return new Set(a.herausgeber);
    return quellenFilter ? new Set([quellenFilter]) : null;
  }, [gewaehlt, quellenFilter, daten.aussagen]);

  const k = daten.kennzahlen;

  return (
    <main className="huelle">
      {kopf}
      <header>
        <div className="eyebrow"><span className="puls" /> BEOBACHTUNGSAUFTRAG · AKTIV</div>
        <h1>{daten.auftrag.name}</h1>
        <p className="frage">{daten.auftrag.fragestellung}</p>
        <div className="kennzahlen">
          <span><b>{k.quellen}</b> Quellen</span>
          <span><b>{k.inhalte}</b> Beiträge</span>
          <span><b>{k.aussagen}</b> Aussagen</span>
          {k.quellenFehler > 0 && (
            <span className="warnung">{k.quellenFehler} Quellen nicht erreichbar</span>
          )}
          {k.letzterAbruf && (
            <span>letzter Abruf: {new Date(k.letzterAbruf).toLocaleString("de-DE")}</span>
          )}
        </div>
      </header>

      <div className="gitter">
        <Quellennetz
          knoten={daten.knoten}
          kanten={daten.kanten}
          hervorgehoben={hervorgehoben}
          aufQuelle={(label) => {
            setGewaehlt(null);
            setQuellenFilter(quellenFilter === label ? null : label);
          }}
        />
        <AussagenListe
          daten={daten}
          gewaehlt={gewaehlt}
          setGewaehlt={(id) => { setGewaehlt(id); if (id) setQuellenFilter(null); }}
          quellenFilter={quellenFilter}
          setQuellenFilter={setQuellenFilter}
        />
      </div>

      <footer className="fuss">
        Diese Ansicht zeigt keine Wahrheit, sondern Belege: wer was behauptet, wie
        unabhängig die Quellen sind und wie belastbar eine Aussage derzeit ist.
        Eine Aussage anzutippen klappt ihre Belege auf und hebt die beteiligten
        Quellen im Netz hervor; eine Quelle anzutippen zeigt ihre Aussagen.
      </footer>
    </main>
  );
}
