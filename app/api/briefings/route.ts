import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/briefings — returns a lightweight list of every briefing
// (id, date, themes heading, tags, ingested timestamp). Sorted by date desc.
export async function GET(_req: NextRequest) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("briefings")
    .select("id, briefing_date, themes_heading, tags, ingested_at")
    .order("briefing_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ briefings: data ?? [] });
}
