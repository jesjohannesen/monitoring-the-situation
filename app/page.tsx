"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { BootScreen } from "@/components/BootScreen";
import { BriefingView, type Briefing } from "@/components/BriefingView";

const STORAGE_KEY = "briefing.user";

export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  const [showBoot, setShowBoot] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let hasUser = false;
    try {
      hasUser = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      hasUser = false;
    }
    setShowBoot(!hasUser);
    setHydrated(true);

    fetch("/api/briefing/latest", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { briefing: Briefing | null };
        setBriefing(json.briefing);
      })
      .catch((e) => {
        setLoadErr(e instanceof Error ? e.message : "load failed");
      });
  }, []);

  function handleBootComplete(user: { id: string; name: string }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore quota / private mode
    }
    setShowBoot(false);
  }

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen w-full flex justify-center px-6 py-16">
      <BriefingView briefing={briefing} loadErr={loadErr} />
      <AnimatePresence>
        {showBoot && <BootScreen onComplete={handleBootComplete} />}
      </AnimatePresence>
    </main>
  );
}
