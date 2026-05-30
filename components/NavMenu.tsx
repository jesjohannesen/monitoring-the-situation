"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { label: string; href: string };

const ITEMS: Item[] = [
  { label: "today's entry", href: "/" },
  { label: "links", href: "/links" },
  { label: "archive", href: "/archive" },
];

export function NavMenu() {
  const [open, setOpen] = useState(false);
  // Scroll-park the trigger glyph for the same reason as the theme toggle —
  // anything scrolling past it would otherwise visually collide.
  const [parked, setParked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Close after navigation completes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function go(href: string) {
    if (href === pathname) {
      setOpen(false);
      return;
    }
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "close navigation" : "open navigation"}
        className="nav-trigger"
        style={{
          position: "fixed",
          top: "12px",
          left: "16px",
          zIndex: 65,
          background: "var(--bg)",
          border: "1px solid var(--border-med)",
          color: "var(--fg)",
          fontFamily: "var(--font-display), monospace",
          fontSize: "26px",
          lineHeight: 1,
          padding: "4px 12px 6px",
          cursor: "pointer",
          textShadow: "var(--glow-strong)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 0 0 4px var(--bg)",
          transform:
            parked && !open ? "translateX(-140%)" : "translateX(0)",
          opacity: parked && !open ? 0 : 1,
          pointerEvents: parked && !open ? "none" : "auto",
          transition:
            "transform 320ms cubic-bezier(.2,.7,.2,1), opacity 220ms ease-out, border-color 120ms ease-out, text-shadow 120ms ease-out",
        }}
      >
        {open ? "×" : "≡"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="nav-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[64] flex items-center justify-center"
            style={{
              background: "var(--overlay-tint)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <motion.nav
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 4, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: 0.04 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                fontFamily: "var(--font-display), monospace",
              }}
              aria-label="primary"
            >
              {ITEMS.map((it, i) => {
                const isActive =
                  it.href === "/"
                    ? pathname === "/"
                    : pathname === it.href ||
                      pathname.startsWith(it.href + "/");
                return (
                  <motion.div
                    key={it.href}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{
                      duration: 0.24,
                      ease: "easeOut",
                      delay: 0.05 + i * 0.06,
                    }}
                  >
                    <Link
                      href={it.href}
                      onClick={(e) => {
                        e.preventDefault();
                        go(it.href);
                      }}
                      className="nav-item"
                      style={{
                        display: "block",
                        color: "var(--fg)",
                        fontFamily: "var(--font-display), monospace",
                        fontSize: "36px",
                        letterSpacing: "0.02em",
                        textTransform: "lowercase",
                        textShadow: isActive
                          ? "var(--glow-strong)"
                          : "var(--glow-soft)",
                        opacity: isActive ? 1 : 0.7,
                        textDecoration: "none",
                        padding: "4px 12px",
                        transition:
                          "opacity 120ms ease-out, text-shadow 120ms ease-out, transform 120ms ease-out",
                      }}
                    >
                      {isActive ? "» " : "> "}
                      {it.label}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .nav-trigger:hover {
          border-color: var(--fg);
          text-shadow:
            0 0 18px rgba(255, 255, 255, 0.6),
            var(--glow-strong);
        }
        [data-theme="light"] .nav-trigger:hover {
          text-shadow:
            1px 1px 0 rgba(0, 0, 0, 0.5),
            0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .nav-item:hover {
          opacity: 1 !important;
          text-shadow: var(--glow-strong) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}
