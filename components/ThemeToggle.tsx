"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "briefing.theme";

function readInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  // Defer state until mount to avoid hydration mismatch — the inline script in
  // layout.tsx will have already set data-theme before paint.
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  // Toggle hides itself once the user scrolls past the date line; reappears
  // when scrolled back near the top.
  const [parked, setParked] = useState(false);

  useEffect(() => {
    setTheme(readInitial());
    setMounted(true);
  }, []);

  useEffect(() => {
    function compute() {
      // The toggle sits at ~y=16 in the viewport. When the date line scrolls
      // above ~y=56 (clearing the toggle's footprint), we park the toggle.
      const dateEl = document.getElementById("briefing-date-line");
      const dateBottom = dateEl?.getBoundingClientRect().bottom ?? 0;
      // If we can't find the element yet, default to "shown".
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

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / private mode
    }
  }

  // Render the same width in both themes so it doesn't shift.
  const label = mounted ? (theme === "dark" ? "light" : "dark") : "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`switch to ${label} mode`}
      className="theme-toggle"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 60,
        background: "var(--bg)",
        border: "1px solid var(--border-med)",
        color: "var(--fg)",
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "lowercase",
        padding: "6px 10px",
        cursor: "pointer",
        transition:
          "transform 320ms cubic-bezier(.2,.7,.2,1), opacity 220ms ease-out, border-color 120ms ease-out, text-shadow 120ms ease-out",
        textShadow: "var(--glow-soft)",
        // A subtle frosted backdrop in case the page bg shows through behind
        // the button — defends against any transparency in `--bg`.
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: "0 0 0 4px var(--bg)",
        // Park: slide off-screen when the user scrolls past the date line.
        transform: parked ? "translateX(140%)" : "translateX(0)",
        opacity: parked ? 0 : 1,
        pointerEvents: parked ? "none" : "auto",
      }}
    >
      &gt; {label}
      <style jsx>{`
        .theme-toggle:hover {
          border-color: var(--fg);
          text-shadow: var(--glow-strong);
        }
      `}</style>
    </button>
  );
}
