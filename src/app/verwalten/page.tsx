/**
 * Verwaltung: eigene Beobachtungsaufträge und der eigene KI-Zugang.
 *
 * Erfüllt Erfolgskriterium 7 - ein neuer Beobachtungsauftrag entsteht ohne
 * Programmierung. Alle Angaben sind Daten; der Kern bleibt themenneutral.
 */
import { redirect } from "next/navigation";
import { angemeldeterNutzer, supabaseAufServer } from "@/lib/supabase-server";
import { AuftragsListe } from "./auftrags-liste";
import { SchluesselFormular, type SchluesselZustand } from "./schluessel-formular";

export const dynamic = "force-dynamic";

interface AuftragZeile {
  readonly id: string;
  readonly name: string;
  readonly fragestellung: string;
  readonly aktiv: boolean;
  readonly oeffentliche_demo: boolean;
}

export default async function Verwalten() {
  const nutzer = await angemeldeterNutzer();
  if (!nutzer) redirect("/anmelden");

  const supabase = await supabaseAufServer();

  // Die Zeilen-Sicherheit liefert ausschließlich eigene Aufträge - hier steht
  // deshalb absichtlich keine zweite Prüfung auf den Besitzer.
  const { data: auftraege, error: auftragsFehler } = await supabase
    .from("auftraege")
    .select("id,name,fragestellung,aktiv,oeffentliche_demo")
    .order("erstellt_am");

  const { data: schluessel } = await supabase.rpc("api_schluessel_zustand");

  return (
    <main className="huelle">
      <div className="kopfzeile">
        <nav className="auftragswahl">
          <a href="/" className="reiter">Zum Dashboard</a>
        </nav>
        <div className="anmeldezustand">
          <span className="anmelde-email">{nutzer.email}</span>
          <form action="/abmelden" method="post">
            <button type="submit" className="knopf knopf-leise">Abmelden</button>
          </form>
        </div>
      </div>

      <p className="eyebrow">VERWALTUNG</p>
      <h1>Beobachtungsaufträge</h1>
      <p className="frage">
        Ein Auftrag ist ein Datensatz, kein Programm. Thema, Fragestellung, Quellen
        und Relevanzregeln legst du hier fest — Windows 11 ist nur der erste Fall.
      </p>

      {auftragsFehler ? (
        <p className="meldung meldung-schlecht">
          Aufträge konnten nicht geladen werden: {auftragsFehler.message}
        </p>
      ) : (
        <AuftragsListe auftraege={(auftraege ?? []) as AuftragZeile[]} />
      )}

      <SchluesselFormular zustand={(schluessel ?? { hinterlegt: false }) as SchluesselZustand} />
    </main>
  );
}
