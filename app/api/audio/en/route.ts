import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { synthesizeWithTimings } from "@/lib/elevenlabs";
import { getCachedAudio, putCachedAudio } from "@/lib/audio-cache";

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
  const briefingDate = parsed.data.briefingDate;

  // 1. Cache hit?
  const cached = await getCachedAudio(briefingDate, "en");
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "x-briefing-cache": "hit", "cache-control": "no-store" },
    });
  }

  // 2. Cache miss — load script + synthesize.
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("briefings")
    .select("english_script")
    .eq("briefing_date", briefingDate)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await synthesizeWithTimings({
    text: data.english_script,
    lang: "en",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "tts failed", detail: result.detail },
      { status: 502 },
    );
  }

  // 3. Write-through cache. We don't await this if it slows the response, but
  // doing so is harmless and ensures the next call sees the cached copy.
  await putCachedAudio(briefingDate, "en", result.data);

  return NextResponse.json(result.data, {
    headers: { "x-briefing-cache": "miss", "cache-control": "no-store" },
  });
}
