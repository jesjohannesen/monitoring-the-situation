"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BootScreen } from "@/components/BootScreen";
import { BriefingHeading } from "@/components/BriefingHeading";
import { SynthesisBlock } from "@/components/SynthesisBlock";
import { AudioButton } from "@/components/AudioButton";

type LinkPreview = {
  title?: string;
  excerpt?: string;
  host?: string;
};

type Briefing = {
  id: string;
  briefing_date: string;
  themes_heading: string;
  synthesis_md: string;
  link_previews?: Record<string, LinkPreview>;
};

const STORAGE_KEY = "briefing.user";

export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  const [showBoot, setShowBoot] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let hasUser = false;
    try {
      hasUser = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      hasUser = false;
    }
    setShowBoot(!hasUser);
    setHydrated(true);

    fetch("/api/briefing/latest", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { briefing: Briefing | null };
        setBriefing(json.briefing);
      })
      .catch((e) => {
        setLoadErr(e instanceof Error ? e.message : "load failed");
      });
  }, []);

  function handleBootComplete(user: { id: string; name: string }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore quota / private mode
    }
    setShowBoot(false);
  }

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen w-full flex justify-center px-6 py-16">
      <motion.div
        key="main-content"
        initial={{ opacity: 0.6, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: showBoot ? 0 : 0 }}
        className="w-full"
        style={{ maxWidth: "680px" }}
      >
        {briefing ? (
          <>
            <BriefingHeading
              themesHeading={briefing.themes_heading}
              briefingDate={briefing.briefing_date}
            />
            <SynthesisBlock
              markdown={briefing.synthesis_md}
              linkPreviews={briefing.link_previews}
            />
            <div className="mt-12 grid grid-cols-2 gap-4">
              <AudioButton
                label="generate english audio"
                endpoint="/api/audio/en"
                briefingDate={briefing.briefing_date}
              />
              <AudioButton
                label="generere lyd på norsk"
                endpoint="/api/audio/no"
                briefingDate={briefing.briefing_date}
              />
            </div>
          </>
        ) : (
          <div
            className="caret"
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            {loadErr
              ? `> error: ${loadErr}`
              : "> awaiting first briefing"}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showBoot && <BootScreen onComplete={handleBootComplete} />}
      </AnimatePresence>
    </main>
  );
}
