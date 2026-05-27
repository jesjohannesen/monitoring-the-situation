"use client";

import { useState } from "react";

type Props = {
  label: string;
  endpoint: "/api/audio/en" | "/api/audio/no";
  briefingDate: string;
};

export function AudioButton({ label, endpoint, briefingDate }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleClick() {
    if (status === "loading") return;
    setStatus("loading");
    setErrMsg(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefingDate }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `request failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setStatus("ready");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "unknown error");
      setStatus("error");
    }
  }

  const displayLabel =
    status === "loading"
      ? "[ ... synthesizing ]"
      : status === "error"
        ? "[ retry ]"
        : `[ ${label} ]`;

  return (
    <div className="flex flex-col w-full">
      <button
        type="button"
        onClick={handleClick}
        className="audio-btn"
        style={{
          border: "1px solid var(--border-strong)",
          background: "transparent",
          color: "var(--fg)",
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "13px",
          letterSpacing: "0.1em",
          padding: "16px 24px",
          textTransform: "uppercase",
          cursor: "pointer",
          transition: "all 120ms ease-out",
          width: "100%",
          textShadow: "var(--glow-soft)",
        }}
      >
        {displayLabel}
      </button>
      {audioUrl && (
        <audio controls src={audioUrl} autoPlay>
          your browser does not support audio
        </audio>
      )}
      {errMsg && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            opacity: 0.6,
            fontFamily: "var(--font-jetbrains), monospace",
          }}
        >
          {errMsg}
        </div>
      )}
      <style jsx>{`
        .audio-btn:hover {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
        .audio-btn:active {
          box-shadow: inset 0 0 0 1px var(--border-med);
        }
      `}</style>
    </div>
  );
}
