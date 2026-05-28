import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("briefing_date");
  const parsed = DateParam.safeParse(date);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad briefing_date" }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("briefing_date", parsed.data)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ annotations: data ?? [] });
}

const CreateBody = z.object({
  briefing_date: DateParam,
  selected_text: z.string().min(1).max(2000),
  occurrence_index: z.number().int().nonnegative().default(0),
  note: z.string().max(5000).default(""),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("annotations")
    .insert(parsed.data)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ annotation: data });
}
