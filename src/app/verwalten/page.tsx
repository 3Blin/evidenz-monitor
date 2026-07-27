/**
 * Verwaltung: eigene Beobachtungsaufträge und der eigene KI-Zugang.
 *
 * Erfüllt Erfolgskriterium 7 - ein neuer Beobachtungsauftrag entsteht ohne
 * Programmierung. Alle Angaben sind Daten; der Kern bleibt themenneutral.
 */
import { redirect } from "next/navigation";
import { angemeldeterNutzer, supabaseAufServer } from "@/lib/supabase-server";
import { AuftragsListe } from "./auftrags-liste";
import { DemoListe, type DemoAuftrag } from "./demo-liste";
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

  // Freigegebene Aufträge fremder Konten. Sie erscheinen in der Liste oben
  // nicht - die Zeilen-Sicherheit gibt nur eigene heraus - und brauchen
  // deshalb einen eigenen Abschnitt samt Weg ins eigene Konto.
  const { data: demos } = await supabase.rpc("oeffentliche_auftraege");
  const eigeneIds = new Set((auftraege ?? []).map((a) => a.id));
  const fremdeDemos = ((demos ?? []) as DemoAuftrag[]).filter((d) => !eigeneIds.has(d.id));

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
        Ein Auftrag beschreibt, was dauerhaft beobachtet werden soll: Thema,
        Fragestellung, Quellen und die Regeln, nach denen ein Beitrag als
        einschlägig gilt. Alles davon sind Angaben, kein Programmcode — dasselbe
        System trägt einen Auftrag über Sicherheitslücken so gut wie einen über
        Personalien oder Preise.
      </p>

      {auftragsFehler ? (
        <p className="meldung meldung-schlecht">
          Aufträge konnten nicht geladen werden: {auftragsFehler.message}
        </p>
      ) : (
        <AuftragsListe auftraege={(auftraege ?? []) as AuftragZeile[]} />
      )}

      <DemoListe
        auftraege={fremdeDemos}
        bereitsUebernommen={(auftraege ?? []).map((a) => a.name)}
      />

      <SchluesselFormular zustand={(schluessel ?? { hinterlegt: false }) as SchluesselZustand} />
    </main>
  );
}
