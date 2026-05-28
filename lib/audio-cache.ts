import { getSupabase } from "./supabase";
import type { TimedAudio } from "./elevenlabs";

const BUCKET = "briefing-audio";

function cacheKey(briefingDate: string, lang: "en" | "no"): string {
  return `${briefingDate}_${lang}.json`;
}

export async function getCachedAudio(
  briefingDate: string,
  lang: "en" | "no",
): Promise<TimedAudio | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(cacheKey(briefingDate, lang));
  if (error || !data) return null;
  try {
    const text = await data.text();
    const json = JSON.parse(text) as TimedAudio;
    if (!json.audio_base64 || !json.alignment) return null;
    return json;
  } catch {
    return null;
  }
}

export async function putCachedAudio(
  briefingDate: string,
  lang: "en" | "no",
  payload: TimedAudio,
): Promise<void> {
  const supabase = getSupabase();
  const body = JSON.stringify(payload);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(cacheKey(briefingDate, lang), body, {
      contentType: "application/json",
      upsert: true,
    });
  if (error) {
    // Cache failures should not break the response; log and move on.
    console.error("[audio-cache] put failed:", error.message);
  }
}

export async function deleteCachedAudio(briefingDate: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([cacheKey(briefingDate, "en"), cacheKey(briefingDate, "no")]);
  if (error) {
    console.error("[audio-cache] delete failed:", error.message);
  }
}
