/**
 * Startseite: zeigt einen Beobachtungsauftrag im Dashboard.
 *
 * Welche Aufträge zur Auswahl stehen, sagt die Datenbank - freigegebene Demos
 * für alle, eigene Aufträge nach Anmeldung. Ob ein Auftrag angezeigt werden
 * darf, prüft ebenfalls die Datenbank (ADR 0004). Diese Seite entscheidet
 * darüber nichts; sie zeigt, was sie bekommt, und erklärt Fehler verständlich.
 */
import { ladeDashboardVonSupabase } from "@/lib/supabase-daten";
import { ladeWebKonfiguration } from "@/lib/konfig";
import { ladeOeffentlicheAuftraege, waehleAuftrag, type AuftragsEintrag } from "@/lib/auftragsliste";
import { angemeldeterNutzer, supabaseAufServer } from "@/lib/supabase-server";
import { DashboardAnsicht } from "./dashboard-ansicht";
import { Kopfzeile } from "./kopfzeile";

export const dynamic = "force-dynamic";

/** Eigene Aufträge des angemeldeten Nutzers. Die Zeilen-Sicherheit filtert. */
async function eigeneAuftraege(): Promise<readonly AuftragsEintrag[]> {
  const supabase = await supabaseAufServer();
  const { data, error } = await supabase
    .from("auftraege")
    .select("id,name,fragestellung")
    .order("erstellt_am");
  if (error || !data) return [];
  return data as AuftragsEintrag[];
}

export default async function Seite({
  searchParams,
}: {
  searchParams: Promise<{ auftrag?: string }>;
}) {
  let konfig;
  try {
    konfig = ladeWebKonfiguration(process.env);
  } catch (fehler) {
    return (
      <main className="huelle">
        <h1>Dashboard nicht verfügbar</h1>
        <p className="frage">{fehler instanceof Error ? fehler.message : String(fehler)}</p>
        <p className="frage">
          Hinweis für den Betrieb: Die drei Werte NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_KEY und NEXT_PUBLIC_AUFTRAG müssen gesetzt sein.
        </p>
      </main>
    );
  }

  const { auftrag: gewuenscht } = await searchParams;
  const nutzer = await angemeldeterNutzer();

  // Fällt die Auswahlliste aus, bleibt das Dashboard bedienbar - dann eben nur
  // mit der Vorauswahl. Ein Fehler in der Auswahl darf die Anzeige nicht kosten.
  let auswahl: readonly AuftragsEintrag[] = [];
  try {
    const oeffentliche = await ladeOeffentlicheAuftraege(
      konfig.supabaseUrl, konfig.supabaseSchluessel,
    );
    const eigene = nutzer ? await eigeneAuftraege() : [];
    const nachId = new Map<string, AuftragsEintrag>();
    for (const a of [...oeffentliche, ...eigene]) nachId.set(a.id, a);
    auswahl = [...nachId.values()];
  } catch {
    // Vorauswahl genügt; die Ursache zeigt sich beim Laden des Dashboards.
    auswahl = [];
  }

  const auftragId = waehleAuftrag(gewuenscht, konfig.auftragId, auswahl);
  const kopf = <Kopfzeile auftraege={auswahl} aktiv={auftragId} nutzer={nutzer} />;

  try {
    const daten = await ladeDashboardVonSupabase(
      konfig.supabaseUrl, konfig.supabaseSchluessel, auftragId,
    );
    return <DashboardAnsicht daten={daten} kopf={kopf} />;
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    return (
      <main className="huelle">
        {kopf}
        <h1>Dieser Auftrag ist nicht abrufbar</h1>
        <p className="frage">{text}</p>
        <p className="frage" style={{ marginTop: 12 }}>
          {nutzer
            ? "Möglich ist auch, dass der Auftrag einer anderen Person gehört."
            : "Nicht freigegebene Aufträge sind nur nach Anmeldung sichtbar."}
        </p>
      </main>
    );
  }
}
