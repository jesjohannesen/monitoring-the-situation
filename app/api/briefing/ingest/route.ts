import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { deleteCachedAudio } from "@/lib/audio-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LinkPreviewSchema = z.object({
  title: z.string().optional(),
  excerpt: z.string().optional(),
  host: z.string().optional(),
});

const SongSuggestionSchema = z
  .object({
    title: z.string().min(1).max(200),
    artist: z.string().min(1).max(200),
    why: z.string().max(1000).default(""),
    spotify_uri: z.string().optional(),
    spotify_external_url: z.string().url().optional(),
  })
  .nullable();

const PayloadSchema = z.object({
  briefing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  themes_heading: z.string().min(1),
  synthesis_md: z.string().min(1),
  english_script: z.string().min(1),
  norwegian_script: z.string().min(1),
  sources: z
    .array(z.object({ title: z.string(), url: z.string().url() }))
    .default([]),
  link_previews: z.record(z.string().url(), LinkPreviewSchema).default({}),
  song_suggestion: SongSuggestionSchema.optional().default(null),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-briefing-secret");
  const expected = process.env.BRIEFING_INGEST_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "server not configured" },
      { status: 500 },
    );
  }
  if (secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("briefings")
    .upsert(parsed.data, { onConflict: "briefing_date" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invalidate any cached audio for this date so a re-ingested briefing gets
  // freshly synthesized audio on the next request.
  await deleteCachedAudio(parsed.data.briefing_date);

  return NextResponse.json({ ok: true, briefing: data });
}
