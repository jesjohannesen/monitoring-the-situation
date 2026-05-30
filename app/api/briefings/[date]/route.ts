import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } },
) {
  const parsed = DateParam.safeParse(params.date);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("briefings")
    .select("*")
    .eq("briefing_date", parsed.data)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ briefing: null }, { status: 404 });
  return NextResponse.json({ briefing: data });
}

const PatchBody = z.object({
  tags: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
});

// PATCH /api/briefings/:date — currently only edits tags. Designed to grow
// (e.g. starring, archiving) as features arrive.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { date: string } },
) {
  const parsedDate = DateParam.safeParse(params.date);
  if (!parsedDate.success) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const json = await req.json().catch(() => null);
  const body = PatchBody.safeParse(json);
  if (!body.success) {
    return NextResponse.json(
      { error: "validation failed", issues: body.error.issues },
      { status: 400 },
    );
  }
  if (Object.keys(body.data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // Normalize tags: lowercase + dedupe + drop empties.
  const update: Record<string, unknown> = {};
  if (body.data.tags) {
    const normalized = Array.from(
      new Set(
        body.data.tags
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    update.tags = normalized;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("briefings")
    .update(update)
    .eq("briefing_date", parsedDate.data)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ briefing: data });
}
