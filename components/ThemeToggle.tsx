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

  useEffect(() => {
    setTheme(readInitial());
    setMounted(true);
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
        background: "transparent",
        border: "1px solid var(--border-med)",
        color: "var(--fg)",
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "lowercase",
        padding: "6px 10px",
        cursor: "pointer",
        transition: "all 120ms ease-out",
        textShadow: "var(--glow-soft)",
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
