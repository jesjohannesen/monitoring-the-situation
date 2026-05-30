"use client";

import { motion } from "framer-motion";
import { FormEvent, useState } from "react";

type Props = {
  onComplete: (user: { id: string; name: string }) => void;
};

export function BootScreen({ onComplete }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `request failed: ${res.status}`);
      }
      const json = (await res.json()) as { id: string };
      onComplete({ id: json.id, name: trimmed });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown error");
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "var(--overlay-tint)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6"
        style={{ minWidth: "260px" }}
      >
        <div
          className="lowercase"
          style={{
            fontFamily: "var(--font-ui), monospace",
            fontSize: "13px",
            letterSpacing: "0.08em",
            opacity: 0.7,
            textShadow: "var(--glow-soft)",
          }}
        >
          &gt; identify yourself
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          spellCheck={false}
          autoComplete="off"
          style={{
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--border-med)",
            outline: "none",
            color: "var(--fg)",
            fontFamily: "var(--font-ui), monospace",
            fontSize: "16px",
            padding: "6px 4px",
            textAlign: "center",
            width: "240px",
            caretColor: "var(--fg)",
          }}
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="boot-go"
          style={{
            background: "transparent",
            border: "1px solid var(--border-strong)",
            color: "var(--fg)",
            fontFamily: "var(--font-ui), monospace",
            fontSize: "13px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "12px 28px",
            cursor: submitting ? "wait" : "pointer",
            opacity: name.trim() ? 1 : 0.4,
            transition: "all 120ms ease-out",
            textShadow: "var(--glow-soft)",
          }}
        >
          {submitting ? "[ ... ]" : "[ go ]"}
        </button>
        {err && (
          <div
            style={{
              fontSize: "12px",
              opacity: 0.6,
              fontFamily: "var(--font-ui), monospace",
            }}
          >
            {err}
          </div>
        )}
      </form>
      <style jsx>{`
        .boot-go:hover:not(:disabled) {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
      `}</style>
    </motion.div>
  );
}
