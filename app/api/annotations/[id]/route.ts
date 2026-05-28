import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdParam = z.string().uuid();

const PatchBody = z.object({
  note: z.string().max(5000),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = IdParam.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const json = await req.json().catch(() => null);
  const body = PatchBody.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("annotations")
    .update({ note: body.data.note, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ annotation: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = IdParam.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const supabase = getSupabase();
  const { error } = await supabase
    .from("annotations")
    .delete()
    .eq("id", id.data);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
