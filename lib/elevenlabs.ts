type Lang = "en" | "no";

type SynthesizeArgs = {
  text: string;
  lang: Lang;
};

export async function synthesizeSpeech({ text, lang }: SynthesizeArgs): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");

  const voiceId =
    lang === "en"
      ? process.env.ELEVENLABS_VOICE_ID_EN
      : process.env.ELEVENLABS_VOICE_ID_NO;
  if (!voiceId) {
    throw new Error(
      `Missing ELEVENLABS_VOICE_ID_${lang.toUpperCase()}`,
    );
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

  // Critical: Norwegian needs explicit language_code on Turbo v2.5, otherwise
  // the model has a habit of sliding toward Danish.
  if (lang === "no") {
    body.language_code = "no";
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  return res;
}
