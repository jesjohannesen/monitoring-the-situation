"use client";

import { motion } from "framer-motion";
import { BriefingHeading } from "./BriefingHeading";
import { AnnotatedSynthesis } from "./AnnotatedSynthesis";
import { AudioSummaries } from "./AudioSummaries";
import { SongOfDay } from "./SongOfDay";
import type { SongSuggestion } from "@/lib/supabase";

type LinkPreview = {
  title?: string;
  excerpt?: string;
  host?: string;
};

export type Briefing = {
  id: string;
  briefing_date: string;
  themes_heading: string;
  synthesis_md: string;
  english_script: string;
  norwegian_script: string;
  link_previews?: Record<string, LinkPreview>;
  tags?: string[];
  song_suggestion?: SongSuggestion | null;
};

type Props = {
  briefing: Briefing | null;
  loadErr?: string | null;
};

export function BriefingView({ briefing, loadErr }: Props) {
  return (
    <motion.div
      key={briefing?.briefing_date ?? "empty"}
      initial={{ opacity: 0.6, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="w-full"
      style={{ maxWidth: "680px" }}
    >
      {briefing ? (
        <>
          <BriefingHeading
            themesHeading={briefing.themes_heading}
            briefingDate={briefing.briefing_date}
          />
          <SongOfDay song={briefing.song_suggestion} />
          <AudioSummaries
            briefingDate={briefing.briefing_date}
            englishScript={briefing.english_script}
            norwegianScript={briefing.norwegian_script}
          />
          <AnnotatedSynthesis
            markdown={briefing.synthesis_md}
            briefingDate={briefing.briefing_date}
            linkPreviews={briefing.link_previews}
          />
        </>
      ) : (
        <div
          className="caret"
          style={{
            fontFamily: "var(--font-ui), monospace",
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          {loadErr ? `> error: ${loadErr}` : "> awaiting briefing"}
        </div>
      )}
    </motion.div>
  );
}
