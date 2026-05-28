type Lang = "en" | "no";

type SynthesizeArgs = {
  text: string;
  lang: Lang;
};

export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export type TimedAudio = {
  audio_base64: string;
  alignment: Alignment;
  normalized_alignment?: Alignment;
};

/**
 * Calls ElevenLabs with the `with-timestamps` endpoint so we receive
 * character-level timing data alongside the audio. The audio comes back as a
 * base64 string inside JSON (instead of being streamed as raw MPEG).
 */
export async function synthesizeWithTimings({
  text,
  lang,
}: SynthesizeArgs): Promise<{ ok: true; data: TimedAudio } | { ok: false; status: number; detail: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");

  const voiceId =
    lang === "en"
      ? process.env.ELEVENLABS_VOICE_ID_EN
      : process.env.ELEVENLABS_VOICE_ID_NO;
  if (!voiceId) {
    throw new Error(`Missing ELEVENLABS_VOICE_ID_${lang.toUpperCase()}`);
  }

  const model_id = lang === "en" ? "eleven_multilingual_v2" : "eleven_turbo_v2_5";

  const body: Record<string, unknown> = {
    text,
    model_id,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  // Norwegian on Turbo v2.5 needs an explicit language_code or it tends to
  // slide toward Danish.
  if (lang === "no") {
    body.language_code = "no";
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, detail };
  }

  const data = (await res.json()) as TimedAudio;
  return { ok: true, data };
}
