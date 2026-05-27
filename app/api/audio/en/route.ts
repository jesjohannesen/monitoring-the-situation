import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { synthesizeSpeech } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  briefingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("briefings")
    .select("english_script")
    .eq("briefing_date", parsed.data.briefingDate)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const tts = await synthesizeSpeech({ text: data.english_script, lang: "en" });
  if (!tts.ok || !tts.body) {
    const detail = await tts.text().catch(() => "");
    return NextResponse.json(
      { error: "tts failed", detail },
      { status: 502 },
    );
  }

  return new Response(tts.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
