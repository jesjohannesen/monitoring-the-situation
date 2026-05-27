import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllRecent } from "./rss";
import { synthesize } from "./synthesize";

const __dirname = dirname(fileURLToPath(import.meta.url));

function todayLocalISO(): string {
  // YYYY-MM-DD in local time (briefing_date should match the day the user wakes up).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const webappUrl = process.env.WEBAPP_URL;
  const secret = process.env.BRIEFING_INGEST_SECRET;
  if (!webappUrl || !secret) {
    throw new Error(
      "Missing WEBAPP_URL or BRIEFING_INGEST_SECRET in environment",
    );
  }

  const userProfile = readFileSync(
    resolve(__dirname, "USER_PROFILE.md"),
    "utf8",
  );

  console.log("[generate] fetching RSS...");
  const items = await fetchAllRecent(24);
  console.log(`[generate] got ${items.length} items in the 24h window`);

  console.log("[generate] synthesizing...");
  const fields = await synthesize(items, userProfile);

  const payload = {
    briefing_date: todayLocalISO(),
    ...fields,
  };

  console.log(`[generate] posting to ${webappUrl}/api/briefing/ingest`);
  const res = await fetch(`${webappUrl}/api/briefing/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-briefing-secret": secret,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ingest failed: ${res.status} ${t}`);
  }
  console.log("[generate] ingest ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
