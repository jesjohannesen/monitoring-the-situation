import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Bypass Next.js's automatic fetch cache so reads always see fresh DB state.
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...(init ?? {}), cache: "no-store" }),
    },
  });
  return cached;
}

export type LinkPreview = {
  title?: string;
  excerpt?: string;
  host?: string;
};

export type BriefingRow = {
  id: string;
  briefing_date: string;
  themes_heading: string;
  synthesis_md: string;
  english_script: string;
  norwegian_script: string;
  sources: Array<{ title: string; url: string }>;
  link_previews: Record<string, LinkPreview>;
  ingested_at: string;
};
