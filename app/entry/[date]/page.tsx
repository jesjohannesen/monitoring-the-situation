"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BriefingView, type Briefing } from "@/components/BriefingView";

export default function EntryPage() {
  const params = useParams<{ date: string }>();
  const date = params?.date;
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    fetch(`/api/briefings/${encodeURIComponent(date)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            if (alive) setLoadErr("no briefing for this date");
            return;
          }
          throw new Error(`status ${res.status}`);
        }
        const json = (await res.json()) as { briefing: Briefing | null };
        if (alive) setBriefing(json.briefing);
      })
      .catch((e) => {
        if (alive) setLoadErr(e instanceof Error ? e.message : "load failed");
      });
    return () => {
      alive = false;
    };
  }, [date]);

  return (
    <main className="min-h-screen w-full flex justify-center px-6 py-16">
      <BriefingView briefing={briefing} loadErr={loadErr} />
    </main>
  );
}
