"use client";

import { useEffect, useRef, useState } from "react";

type Style = "hacker" | "cognition" | "paul-allen";
type Mode = "dark" | "light";

const STYLE_KEY = "briefing.style";
const MODE_KEY = "briefing.mode";

const STYLES: Array<{ id: Style; label: string }> = [
  { id: "hacker", label: "hacker" },
  { id: "cognition", label: "cognition" },
  { id: "paul-allen", label: "paul allen" },
];
const MODES: Array<{ id: Mode; label: string }> = [
  { id: "dark", label: "dark" },
  { id: "light", label: "light" },
];

/**
 * When the user selects "paul allen", play a curated edit of the iconic
 * business-card scene from American Psycho.
 *
 * True crossfade between the two clips using a pair of <audio> elements:
 *   - A plays from 0:58 at full volume.
 *   - B plays silently from 1:13 in parallel and is re-seeked just before
 *     the cut so its currentTime is exactly 1:13 when we start fading it in.
 *   - At t=4.0s the two ramps run simultaneously (A: PEAK→0, B: 0→PEAK),
 *     so the fade-in begins during the fade-out — no gap of silence.
 *
 *   t = 0s     → A starts at 0:58 (PEAK), B starts silent at 1:13 (0)
 *   t = 3.95s  → reseat B.currentTime to 1:13 to undo silent drift
 *   t = 4.00s  → A fades PEAK→0  AND  B fades 0→PEAK (700ms, overlapping)
 *   t = 4.80s  → pause A
 *   t = 14.0s  → B outro fade (600ms)
 *   t = 14.7s  → hard stop
 *
 * The click on the menu item counts as a user gesture, so autoplay is
 * permitted by the browser. Playing B silently from t=0 (rather than
 * delaying play() until the cut) keeps it inside the same gesture window
 * and avoids any buffer-spin-up latency at the crossfade.
 *
 * The active session (audio elements + timer ids) lives at module scope so
 * the style picker can `stopPaulAllenSting()` mid-playback when the user
 * switches away, and so a re-entry into paul-allen starts cleanly from t=0
 * rather than overlapping a still-running prior session.
 */
type StingSession = {
  a: HTMLAudioElement;
  b: HTMLAudioElement;
  timers: number[];
};
let currentSting: StingSession | null = null;

function stopPaulAllenSting() {
  const session = currentSting;
  if (!session) return;
  currentSting = null;
  // setTimeout and setInterval IDs share the same numeric handle space in
  // browsers, but call both clear* on each id for safety.
  for (const id of session.timers) {
    try {
      window.clearTimeout(id);
    } catch {
      /* ignore */
    }
    try {
      window.clearInterval(id);
    } catch {
      /* ignore */
    }
  }
  try {
    session.a.pause();
  } catch {
    /* ignore */
  }
  try {
    session.b.pause();
  } catch {
    /* ignore */
  }
}

function playPaulAllenSting() {
  // Tear down any prior session so a re-entry into paul-allen starts cleanly.
  stopPaulAllenSting();
  try {
    const a = new Audio("/audio/paul-allen.mp3");
    const b = new Audio("/audio/paul-allen.mp3");
    a.preload = "auto";
    b.preload = "auto";
    const PEAK = 0.95; // peak playback volume (HTMLAudioElement caps at 1.0)
    const CROSSFADE_MS = 700; // both ramps run in parallel over this window
    const END_FADE_OUT_MS = 600; // outro fade at the end of the second clip
    const TICK = 30;

    a.volume = PEAK;
    b.volume = 0;
    a.currentTime = 58;
    b.currentTime = 73; // 1:13

    // Start both immediately — B is silent, just keeping its audio thread
    // warm so the crossfade can begin instantly without buffer lag.
    void a.play();
    void b.play();

    const timers: number[] = [];
    const session: StingSession = { a, b, timers };
    currentSting = session;

    function schedule(ms: number, fn: () => void) {
      timers.push(window.setTimeout(fn, ms));
    }

    function rampVolume(
      audio: HTMLAudioElement,
      from: number,
      to: number,
      ms: number,
    ) {
      const start = performance.now();
      const id = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / ms);
        audio.volume = Math.max(0, from + (to - from) * t);
        if (t >= 1) window.clearInterval(id);
      }, TICK);
      timers.push(id);
    }

    // Just before the cut, re-seek B back to 1:13 to cancel the silent
    // playback drift that's accumulated since t=0.
    schedule(3950, () => {
      try {
        b.currentTime = 73;
      } catch {
        /* ignore */
      }
    });

    // Crossfade: both ramps run simultaneously so the fade-in starts during
    // the fade-out — no perceptible gap.
    schedule(4000, () => {
      rampVolume(a, PEAK, 0, CROSSFADE_MS);
      rampVolume(b, 0, PEAK, CROSSFADE_MS);
    });

    // Free A shortly after its ramp completes.
    schedule(4000 + CROSSFADE_MS + 100, () => {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
    });

    // B outro fade and stop.
    schedule(14000, () => rampVolume(b, PEAK, 0, END_FADE_OUT_MS));
    schedule(14700, () => {
      try {
        b.pause();
      } catch {
        /* ignore */
      }
    });

    // Safety belt — ensure nothing is still playing 18s after selection,
    // and clear the module-level reference so future re-entries don't see
    // a stale completed session.
    schedule(18000, () => {
      try {
        a.pause();
        b.pause();
      } catch {
        /* ignore */
      }
      if (currentSting === session) currentSting = null;
    });
  } catch {
    /* if Audio() throws (rare), just skip the sting */
  }
}

function readInitial(): { style: Style; mode: Mode } {
  if (typeof document === "undefined") return { style: "hacker", mode: "dark" };
  const root = document.documentElement;
  const s = root.getAttribute("data-style");
  const m = root.getAttribute("data-mode");
  const style: Style =
    s === "cognition" ? "cognition" : s === "paul-allen" ? "paul-allen" : "hacker";
  const mode: Mode = m === "light" ? "light" : "dark";
  return { style, mode };
}

export function ThemeToggle() {
  const [style, setStyle] = useState<Style>("hacker");
  const [mode, setMode] = useState<Mode>("dark");
  const [mounted, setMounted] = useState(false);
  const [parked, setParked] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const i = readInitial();
    setStyle(i.style);
    setMode(i.mode);
    setMounted(true);
  }, []);

  useEffect(() => {
    function compute() {
      const dateEl = document.getElementById("briefing-date-line");
      const dateBottom = dateEl?.getBoundingClientRect().bottom ?? 0;
      if (!dateEl) {
        setParked(false);
        return;
      }
      setParked(dateBottom < 56);
    }
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickStyle(next: Style) {
    const wasDifferent = next !== style;
    // Stop the sting if we're leaving paul-allen mid-playback. (Entering
    // paul-allen tears down any stale session inside playPaulAllenSting,
    // so we only need to handle the leaving case here.)
    if (wasDifferent && style === "paul-allen" && next !== "paul-allen") {
      stopPaulAllenSting();
    }
    setStyle(next);
    document.documentElement.setAttribute("data-style", next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch {
      /* ignore */
    }
    if (wasDifferent && next === "paul-allen") {
      // Every time the user enters paul-allen, force light mode — the card
      // on the white tabletop is the canonical look. Once they're inside
      // paul-allen, they're free to flip the mode column to dark; that
      // choice is preserved until they leave the style and come back.
      if (mode !== "light") {
        pickMode("light");
      }
      playPaulAllenSting();
    }
  }
  function pickMode(next: Mode) {
    setMode(next);
    document.documentElement.setAttribute("data-mode", next);
    // Keep the legacy data-theme attribute in sync for back-compat.
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const label = mounted ? `${style} · ${mode}` : "hacker · dark";

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 60,
        transform: parked ? "translateX(140%)" : "translateX(0)",
        opacity: parked ? 0 : 1,
        pointerEvents: parked ? "none" : "auto",
        transition:
          "transform 320ms cubic-bezier(.2,.7,.2,1), opacity 220ms ease-out",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="appearance"
        aria-expanded={open}
        className="theme-toggle"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border-med)",
          color: "var(--fg)",
          fontFamily: "var(--font-ui), monospace",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "lowercase",
          padding: "6px 10px",
          cursor: "pointer",
          transition:
            "border-color 120ms ease-out, text-shadow 120ms ease-out",
          textShadow: "var(--glow-soft)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 0 0 4px var(--bg)",
        }}
      >
        &gt; {label} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--bg)",
            border: "1px solid var(--border-med)",
            minWidth: "180px",
            padding: "4px 0",
            boxShadow: "0 6px 18px rgba(0,0,0,0.35), 0 0 0 4px var(--bg)",
            fontFamily: "var(--font-ui), monospace",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "lowercase",
          }}
        >
          <Section
            title="style"
            options={STYLES}
            current={style}
            onPick={(v) => pickStyle(v as Style)}
          />
          <div
            style={{
              borderTop: "1px solid var(--border-faint)",
              margin: "4px 0",
            }}
          />
          <Section
            title="mode"
            options={MODES}
            current={mode}
            onPick={(v) => pickMode(v as Mode)}
          />
        </div>
      )}
      <style jsx>{`
        .theme-toggle:hover {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
        .theme-option:hover {
          background: var(--border-faint);
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

function Section<T extends string>({
  title,
  options,
  current,
  onPick,
}: {
  title: string;
  options: Array<{ id: T; label: string }>;
  current: T;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: 0.45,
          padding: "4px 12px 2px",
        }}
      >
        {title}
      </div>
      {options.map((o) => {
        const active = o.id === current;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="theme-option"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg)",
              width: "100%",
              textAlign: "left",
              padding: "5px 12px",
              cursor: "pointer",
              opacity: active ? 1 : 0.7,
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "inherit",
              textTransform: "inherit",
              textShadow: active ? "var(--glow-soft)" : "none",
            }}
          >
            {active ? "» " : "  "}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
