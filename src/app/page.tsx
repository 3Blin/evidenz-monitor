/**
 * Startseite: lädt die Daten des Beobachtungsauftrags serverseitig aus
 * Supabase und zeigt das Dashboard. Fehler werden verständlich angezeigt.
 */
import { ladeDashboardVonSupabase } from "@/lib/supabase-daten";
import { ladeWebKonfiguration } from "@/lib/konfig";
import { DashboardAnsicht } from "./dashboard-ansicht";

export const dynamic = "force-dynamic";

export default async function Seite() {
  try {
    const konfig = ladeWebKonfiguration(process.env);
    const daten = await ladeDashboardVonSupabase(
      konfig.supabaseUrl, konfig.supabaseSchluessel, konfig.auftragId,
    );
    return <DashboardAnsicht daten={daten} />;
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    return (
      <main className="huelle">
        <h1>Dashboard nicht verfügbar</h1>
        <p className="frage">{text}</p>
        <p className="frage">
          Hinweis für den Betrieb: Die drei Werte NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_KEY und NEXT_PUBLIC_AUFTRAG müssen gesetzt sein.
        </p>
      </main>
    );
  }
}
