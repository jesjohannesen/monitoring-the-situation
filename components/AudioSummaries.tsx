"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioButton } from "./AudioButton";

type Props = {
  briefingDate: string;
  englishScript: string;
  norwegianScript: string;
};

export function AudioSummaries({
  briefingDate,
  englishScript,
  norwegianScript,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: "28px" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="audio-summaries-toggle"
        aria-expanded={open}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--fg)",
          fontFamily: "var(--font-vt323), monospace",
          fontSize: "20px",
          letterSpacing: "0.03em",
          opacity: 0.7,
          textTransform: "lowercase",
          cursor: "pointer",
          padding: "6px 0",
          textShadow: "var(--glow-strong)",
          transition: "opacity 120ms ease-out",
        }}
      >
        &gt; audio summaries [{open ? "−" : "+"}]
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="audio-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="grid grid-cols-2 gap-4"
              style={{ paddingTop: "12px" }}
            >
              <AudioButton
                label="english audio"
                endpoint="/api/audio/en"
                briefingDate={briefingDate}
                scriptText={englishScript}
                scriptTitle="english_script.txt"
                generateLabel="generate audio"
              />
              <AudioButton
                label="lyd på norsk"
                endpoint="/api/audio/no"
                briefingDate={briefingDate}
                scriptText={norwegianScript}
                scriptTitle="norwegian_script.txt"
                generateLabel="generer lyd"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style jsx>{`
        .audio-summaries-toggle:hover {
          opacity: 0.9 !important;
        }
      `}</style>
    </div>
  );
}
