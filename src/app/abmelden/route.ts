/**
 * Abmelden. Als POST, damit ein fremder Verweis oder ein vorausgeladenes Bild
 * niemanden ungefragt abmelden kann.
 */
import { NextResponse } from "next/server";
import { supabaseAufServer } from "@/lib/supabase-server";

export async function POST(anfrage: Request): Promise<NextResponse> {
  const supabase = await supabaseAufServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${new URL(anfrage.url).origin}/`, { status: 303 });
}
