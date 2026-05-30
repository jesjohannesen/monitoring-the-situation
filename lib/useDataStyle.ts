"use client";

import { useEffect, useState } from "react";

export type DataStyle = "hacker" | "cognition" | "paul-allen";

/**
 * Read the active `data-style` attribute from <html> and keep it in sync
 * via MutationObserver, so components that care about the active style
 * (e.g. to swap toggle symbols) re-render when the user picks a new one.
 */
export function useDataStyle(): DataStyle {
  const [style, setStyle] = useState<DataStyle>("hacker");
  useEffect(() => {
    function read() {
      const v = document.documentElement.getAttribute("data-style");
      if (v === "cognition" || v === "paul-allen") setStyle(v);
      else setStyle("hacker");
    }
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-style"],
    });
    return () => obs.disconnect();
  }, []);
  return style;
}

/**
 * Toggle indicator paired with `useDataStyle`. Hacker uses bracketed plus/
 * minus to keep the terminal feel; cognition + paul-allen use a solid
 * chevron arrow. Both components that own collapsible sections share this
 * so the language stays consistent across the page.
 */
export function toggleSymbol(style: DataStyle, open: boolean): string {
  if (style === "hacker") return open ? "[−]" : "[+]";
  return open ? "▾" : "▸";
}
