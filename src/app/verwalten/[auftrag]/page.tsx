/**
 * Einen Auftrag bearbeiten: Relevanzregeln und Quellen.
 *
 * Lädt serverseitig; ob die Zeilen zum Nutzer gehören, entscheidet die
 * Zeilen-Sicherheit. Findet sie nichts, gehört der Auftrag jemand anderem oder
 * existiert nicht - beides führt zur gleichen, knappen Antwort.
 */
import { redirect } from "next/navigation";
import { angemeldeterNutzer, supabaseAufServer } from "@/lib/supabase-server";
import { AuftragsFormular, type AuftragVollstaendig } from "./auftrags-formular";
import { QuellenVerwaltung, type QuelleZeile } from "./quellen-verwaltung";

export const dynamic = "force-dynamic";

export default async function AuftragBearbeiten({
  params,
}: {
  params: Promise<{ auftrag: string }>;
}) {
  const nutzer = await angemeldeterNutzer();
  if (!nutzer) redirect("/anmelden");

  const { auftrag: auftragId } = await params;
  const supabase = await supabaseAufServer();

  const { data: auftrag } = await supabase
    .from("auftraege")
    // Eine zusammenhängende Zeichenkette, nicht verkettet: supabase-js leitet
    // den Rückgabetyp aus diesem Literal ab.
    .select("id,name,zielbeschreibung,fragestellung,suchbegriffe,pflichtbegriffe,ausschlussbegriffe,mindest_treffer,intervall_min_minuten,intervall_max_minuten,aktueller_takt_minuten,naechster_lauf_am,aktiv,oeffentliche_demo")
    .eq("id", auftragId)
    .maybeSingle();

  if (!auftrag) {
    return (
      <main className="huelle">
        <div className="kopfzeile">
          <nav className="auftragswahl">
            <a href="/verwalten" className="reiter">Zur Verwaltung</a>
          </nav>
        </div>
        <h1>Auftrag nicht gefunden</h1>
        <p className="frage">
          Entweder gibt es diesen Auftrag nicht, oder er gehört einer anderen Person.
          Die Datenbank gibt nur eigene Aufträge heraus.
        </p>
      </main>
    );
  }

  const { data: quellen } = await supabase
    .from("quellen")
    .select("id,url,typ,herausgeber,sprache,aktiv,themenspezifisch")
    .eq("auftrag_id", auftragId)
    .order("herausgeber");

  return (
    <main className="huelle">
      <div className="kopfzeile">
        <nav className="auftragswahl">
          <a href="/verwalten" className="reiter">Zur Verwaltung</a>
          <a href={`/?auftrag=${auftragId}`} className="reiter">Im Dashboard ansehen</a>
        </nav>
        <div className="anmeldezustand">
          <span className="anmelde-email">{nutzer.email}</span>
        </div>
      </div>

      <p className="eyebrow">AUFTRAG BEARBEITEN</p>
      <h1>{auftrag.name}</h1>

      <AuftragsFormular auftrag={auftrag as AuftragVollstaendig} />
      <QuellenVerwaltung auftragId={auftragId} quellen={(quellen ?? []) as QuelleZeile[]} />
    </main>
  );
}
