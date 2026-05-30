"use client";

import { motion } from "framer-motion";
import { FormEvent, useState } from "react";

type User = { id: string; name: string };

type Props = {
  onComplete: (user: User) => void;
};

type Step = "name" | "spotify";

export function BootScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [user, setUser] = useState<User | null>(null);
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
      const newUser: User = { id: json.id, name: trimmed };
      setUser(newUser);

      // Decide whether to surface the Spotify offer step. We don't want
      // to nag returning users who are already connected, so check.
      let loggedIn = false;
      try {
        const me = await fetch("/api/spotify/me", { cache: "no-store" });
        if (me.ok) {
          const j = (await me.json()) as { logged_in?: boolean };
          loggedIn = !!j.logged_in;
        }
      } catch {
        /* leave loggedIn=false and prompt — they can always skip */
      }

      if (loggedIn) {
        onComplete(newUser);
        return;
      }
      setStep("spotify");
      setSubmitting(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown error");
      setSubmitting(false);
    }
  }

  function skipSpotify() {
    if (!user) return;
    onComplete(user);
  }

  function loginSpotify() {
    if (!user) return;
    // Pre-persist the user via the parent callback so when Spotify bounces
    // us back to /, the BootScreen doesn't show up again. The callback
    // also unmounts this modal — that's fine, the redirect is about to
    // navigate away anyway.
    onComplete(user);
    window.location.href = `/api/spotify/auth?return_to=${encodeURIComponent(
      "/",
    )}`;
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
      {step === "name" ? (
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
      ) : (
        <div
          className="flex flex-col items-center"
          style={{ minWidth: "300px", gap: "20px" }}
        >
          <div
            className="lowercase"
            style={{
              fontFamily: "var(--font-ui), monospace",
              fontSize: "13px",
              letterSpacing: "0.08em",
              opacity: 0.7,
              textShadow: "var(--glow-soft)",
              textAlign: "center",
            }}
          >
            &gt; welcome{user ? `, ${user.name.toLowerCase()}` : ""}
          </div>
          <div
            style={{
              fontFamily: "var(--font-ui), monospace",
              fontSize: "14px",
              opacity: 0.85,
              textAlign: "center",
              maxWidth: "320px",
              lineHeight: 1.5,
            }}
          >
            connect spotify to play the song of the day inline?
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={loginSpotify}
              className="boot-go"
              style={{
                background: "transparent",
                border: "1px solid var(--border-strong)",
                color: "var(--fg)",
                fontFamily: "var(--font-ui), monospace",
                fontSize: "13px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "10px 22px",
                cursor: "pointer",
                transition: "all 120ms ease-out",
                textShadow: "var(--glow-soft)",
              }}
            >
              [ connect ]
            </button>
            <button
              type="button"
              onClick={skipSpotify}
              className="boot-go"
              style={{
                background: "transparent",
                border: "1px solid var(--border-med)",
                color: "var(--fg)",
                fontFamily: "var(--font-ui), monospace",
                fontSize: "13px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "10px 22px",
                cursor: "pointer",
                opacity: 0.7,
                transition: "all 120ms ease-out",
                textShadow: "var(--glow-soft)",
              }}
            >
              [ skip ]
            </button>
          </div>
          <div
            style={{
              fontSize: "11px",
              opacity: 0.5,
              textAlign: "center",
              fontFamily: "var(--font-ui), monospace",
              maxWidth: "300px",
              lineHeight: 1.5,
            }}
          >
            you can connect later from the song-of-the-day card
          </div>
        </div>
      )}
      <style jsx>{`
        .boot-go:hover:not(:disabled) {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
      `}</style>
    </motion.div>
  );
}
