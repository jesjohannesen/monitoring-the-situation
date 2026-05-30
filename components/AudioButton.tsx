"use client";

import {
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence } from "framer-motion";
import { ScriptWindow } from "./ScriptWindow";

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type TimedAudioResponse = {
  audio_base64: string;
  alignment: Alignment;
};

type Props = {
  label: string;
  endpoint: "/api/audio/en" | "/api/audio/no";
  briefingDate: string;
  scriptText: string;
  scriptTitle: string;
  generateLabel: string;
};

type Status = "idle" | "loading" | "ready" | "error";

function base64ToBlob(b64: string, mime = "audio/mpeg"): Blob {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export function AudioButton({
  label,
  endpoint,
  briefingDate,
  scriptText,
  scriptTitle,
  generateLabel,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Revoke the blob URL only when AudioButton unmounts for good.
  const audioUrlRef = useRef<string | null>(null);
  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function startSynthesis() {
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
      const json = (await res.json()) as TimedAudioResponse;
      if (!json.audio_base64 || !json.alignment) {
        throw new Error("malformed tts response");
      }
      const blob = base64ToBlob(json.audio_base64);
      const url = URL.createObjectURL(blob);
      // Revoke previous (if any) before swapping.
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      setAudioUrl(url);
      setAlignment(json.alignment);
      setStatus("ready");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "unknown error");
      setStatus("error");
    }
  }

  function handleClick() {
    setOpen(true);
    // Synthesis is NOT auto-fired. The user must press the in-window
    // [ generate audio ] button to call ElevenLabs and burn credits.
  }

  function handleClose() {
    setOpen(false);
  }

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
          fontFamily: "var(--font-ui), monospace",
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
        {`[ ${label} ]`}
      </button>

      <AnimatePresence>
        {open && (
          <ScriptWindow title={scriptTitle} onClose={handleClose}>
            <ScriptBody
              status={status}
              audioUrl={audioUrl}
              alignment={alignment}
              errMsg={errMsg}
              scriptText={scriptText}
              generateLabel={generateLabel}
              onGenerate={startSynthesis}
            />
          </ScriptWindow>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .audio-btn:hover {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
        .audio-btn:active {
          box-shadow: inset 0 0 0 1px var(--border-med);
        }
        .audio-inline-generate:hover {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
        .audio-inline-generate:active {
          box-shadow: inset 0 0 0 1px var(--border-med);
        }
      `}</style>
    </div>
  );
}

/* ─── ScriptBody (window contents) ─────────────────────────────────────── */

type Token = {
  text: string;
  isWord: boolean;
  start: number;
  end: number;
  wordIndex: number | null;
};

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Words = letter/number runs (incl. Norwegian å/ø/æ via \p{L}), with internal
  // apostrophes and hyphens permitted.
  const re = /([\p{L}\p{N}]+(?:['\-’][\p{L}\p{N}]+)*)/gu;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  let wi = 0;
  while ((m = re.exec(text))) {
    if (m.index > lastEnd) {
      tokens.push({
        text: text.slice(lastEnd, m.index),
        isWord: false,
        start: lastEnd,
        end: m.index,
        wordIndex: null,
      });
    }
    const word = m[0];
    tokens.push({
      text: word,
      isWord: true,
      start: m.index,
      end: m.index + word.length,
      wordIndex: wi++,
    });
    lastEnd = m.index + word.length;
  }
  if (lastEnd < text.length) {
    tokens.push({
      text: text.slice(lastEnd),
      isWord: false,
      start: lastEnd,
      end: text.length,
      wordIndex: null,
    });
  }
  return tokens;
}

function findCharIndex(starts: number[], t: number): number {
  // Largest i with starts[i] <= t.
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function ScriptBody({
  status,
  audioUrl,
  alignment,
  errMsg,
  scriptText,
  generateLabel,
  onGenerate,
}: {
  status: Status;
  audioUrl: string | null;
  alignment: Alignment | null;
  errMsg: string | null;
  scriptText: string;
  generateLabel: string;
  onGenerate: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);

  // Clear the auto-paused notice when user manually resumes.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    function onPlay() {
      setAutoPaused(false);
    }
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, [audioUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Status / generate button / audio control */}
      <div
        style={{
          paddingBottom: "12px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: "var(--font-ui), monospace",
          fontSize: "13px",
        }}
      >
        {status === "idle" && (
          <button
            type="button"
            onClick={onGenerate}
            className="audio-inline-generate"
            style={{
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--fg)",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "12px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "10px 18px",
              cursor: "pointer",
              transition: "all 120ms ease-out",
              textShadow: "var(--glow-soft)",
            }}
          >
            [ {generateLabel} ]
          </button>
        )}
        {status === "loading" && (
          <span className="caret" style={{ opacity: 0.7 }}>
            &gt; synthesizing audio
          </span>
        )}
        {status === "error" && (
          <span style={{ opacity: 0.7 }}>
            &gt; error: {errMsg ?? "unknown"} —{" "}
            <button
              type="button"
              onClick={onGenerate}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--fg)",
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: "inherit",
                fontSize: "inherit",
                padding: 0,
              }}
            >
              retry
            </button>
          </span>
        )}
        {status === "ready" && audioUrl && (
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            autoPlay
            style={{ marginTop: 0 }}
          >
            your browser does not support audio
          </audio>
        )}
        {autoPaused && (
          <div
            style={{
              marginTop: "8px",
              fontFamily: "var(--font-ui), monospace",
              fontSize: "12px",
              opacity: 0.65,
              textShadow: "var(--glow-soft)",
            }}
          >
            &gt; auto-paused — press play to resume read-along
          </div>
        )}
      </div>

      {/* Script body — read-along when alignment is present */}
      <ReadAlongScript
        scriptText={scriptText}
        alignment={alignment}
        audioRef={audioRef}
        onAutoPause={() => setAutoPaused(true)}
      />
    </div>
  );
}

function ReadAlongScript({
  scriptText,
  alignment,
  audioRef,
  onAutoPause,
}: {
  scriptText: string;
  alignment: Alignment | null;
  audioRef: RefObject<HTMLAudioElement>;
  onAutoPause?: () => void;
}) {
  // Use the alignment's character sequence as ground truth when available so
  // highlighted positions exactly match what's being spoken. Falls back to the
  // raw script text when no alignment yet.
  const displayText = useMemo(
    () => (alignment ? alignment.characters.join("") : scriptText),
    [alignment, scriptText],
  );
  const tokens = useMemo(() => tokenize(displayText), [displayText]);
  const [activeWord, setActiveWord] = useState<number | null>(null);
  const activeWordElRef = useRef<HTMLSpanElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to audio timeupdate and compute the active word.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !alignment) return;
    const starts = alignment.character_start_times_seconds;

    function compute() {
      if (!el) return;
      const ci = findCharIndex(starts, el.currentTime);
      if (ci < 0) {
        setActiveWord((prev) => (prev === null ? prev : null));
        return;
      }
      // Find which token contains ci. Tokens are in order; a small linear scan
      // is fine for ~400-word scripts. For really long scripts we'd switch to
      // a precomputed char→wordIndex array.
      let found: number | null = null;
      for (const t of tokens) {
        if (t.isWord && t.start <= ci && ci < t.end) {
          found = t.wordIndex;
          break;
        }
        if (t.start > ci) break;
      }
      setActiveWord((prev) => (prev === found ? prev : found));
    }

    el.addEventListener("timeupdate", compute);
    el.addEventListener("seeked", compute);
    el.addEventListener("play", compute);
    el.addEventListener("ended", () => setActiveWord(null));
    compute();
    return () => {
      el.removeEventListener("timeupdate", compute);
      el.removeEventListener("seeked", compute);
      el.removeEventListener("play", compute);
    };
  }, [alignment, tokens, audioRef]);

  // Auto-scroll the active word into view when it changes.
  useEffect(() => {
    if (activeWordElRef.current) {
      activeWordElRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeWord]);

  // Detect "user is fighting the auto-scroll" — two upward user gestures
  // within a short window → pause audio so they can navigate freely.
  // We listen to `wheel` and `keydown` (Arrow/Page/Home) events which
  // `scrollIntoView` doesn't emit, so we cleanly distinguish user intent.
  useEffect(() => {
    if (!alignment) return;
    // Find nearest scrollable ancestor (the ScriptWindow's body container).
    let container: HTMLElement | null = rootRef.current;
    while (container) {
      const style = window.getComputedStyle(container);
      if (style.overflowY === "auto" || style.overflowY === "scroll") break;
      container = container.parentElement;
    }
    if (!container) return;

    let userUpCount = 0;
    let resetTimer: number | null = null;

    function resetSoon() {
      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        userUpCount = 0;
        resetTimer = null;
      }, 2500);
    }

    function maybePause() {
      const audio = audioRef.current;
      if (userUpCount >= 2 && audio && !audio.paused) {
        audio.pause();
        userUpCount = 0;
        if (resetTimer) {
          window.clearTimeout(resetTimer);
          resetTimer = null;
        }
        onAutoPause?.();
      }
    }

    function onWheel(e: WheelEvent) {
      if (e.deltaY < -4) {
        userUpCount += 1;
        resetSoon();
        maybePause();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (
        e.key === "ArrowUp" ||
        e.key === "PageUp" ||
        e.key === "Home"
      ) {
        userUpCount += 1;
        resetSoon();
        maybePause();
      }
    }

    // Wheel is dispatched on the scrolling container; keyboard goes to window.
    container.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      container?.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      if (resetTimer) window.clearTimeout(resetTimer);
    };
  }, [alignment, audioRef, onAutoPause]);

  return (
    <div
      ref={rootRef}
      style={{
        fontFamily: "var(--font-body), monospace",
        fontSize: "15px",
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
      }}
    >
      {tokens.map((t, i) => {
        if (!t.isWord) {
          return <span key={i}>{t.text}</span>;
        }
        const isActive = t.wordIndex === activeWord;
        const dim = alignment !== null && !isActive;
        return (
          <span
            key={i}
            ref={isActive ? activeWordElRef : null}
            style={{
              opacity: dim ? 0.45 : 1,
              background: isActive ? "var(--border-soft)" : "transparent",
              textShadow: isActive ? "var(--glow-strong)" : undefined,
              padding: isActive ? "1px 3px" : "0",
              margin: isActive ? "0 -3px" : "0",
              borderRadius: "2px",
              transition:
                "opacity 120ms linear, background 120ms linear, text-shadow 120ms linear",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </div>
  );
}
