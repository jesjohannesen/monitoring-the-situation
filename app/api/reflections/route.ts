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
    .from("reflections")
    .select("*")
    .eq("briefing_date", parsed.data)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reflection: data ?? null });
}

const PutBody = z.object({
  briefing_date: DateParam,
  content: z.string().max(200_000),
});

export async function PUT(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reflections")
    .upsert(
      {
        briefing_date: parsed.data.briefing_date,
        content: parsed.data.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "briefing_date" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reflection: data });
}
