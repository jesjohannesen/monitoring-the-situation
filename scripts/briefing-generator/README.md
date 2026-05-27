# briefing-generator

Runs daily, pulls RSS from WSJ / The Economist / Wired, lets a synthesizer
function turn the raw items + a user profile into four briefing fields, then
POSTs them to the webapp's ingest endpoint.

## Files

- `rss.ts` — fetch + parse the three RSS sources, filter to last 24h.
- `synthesize.ts` — the swap-in function. Default impl is a placeholder. The
  Cowork run (or any LLM caller) overwrites this with a real implementation.
- `generate.ts` — orchestrator. RSS -> synthesize -> POST.
- `USER_PROFILE.md` — personalization context passed into `synthesize`.

## Running locally

From the repo root:

```bash
# 1. Make sure the webapp is running on the URL you'll POST to.
npm run dev   # in one terminal

# 2. Run the generator.
WEBAPP_URL=http://localhost:3000 \
BRIEFING_INGEST_SECRET=your-secret \
npm run generate
```

## Wiring into a daily cron

### Claude Cowork scheduled task

Set up a Cowork scheduled task to run every morning. The task should:

1. Run `scripts/briefing-generator/rss.ts` (or call the same fetcher) to grab
   the items.
2. Read `USER_PROFILE.md`.
3. Use the in-Cowork Claude session to write a real `synthesize.ts` that
   returns hardcoded fields for today (or extend the function to call your
   preferred model).
4. Run `npm run generate` from the project root, passing `WEBAPP_URL` and
   `BRIEFING_INGEST_SECRET`.

### Plain cron

```cron
0 6 * * *  cd /path/to/briefing && WEBAPP_URL=https://briefing.example.com \
  BRIEFING_INGEST_SECRET=... npm run generate >> /var/log/briefing.log 2>&1
```

### GitHub Actions

```yaml
name: daily-briefing
on:
  schedule:
    - cron: "0 11 * * *"   # 06:00 US/Eastern in summer; adjust for DST
  workflow_dispatch: {}

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run generate
        env:
          WEBAPP_URL: ${{ secrets.WEBAPP_URL }}
          BRIEFING_INGEST_SECRET: ${{ secrets.BRIEFING_INGEST_SECRET }}
```

Note: the default `synthesize.ts` is a stub. GitHub Actions alone will only
produce placeholder output — wire in a real synthesizer first.
