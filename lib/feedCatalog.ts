/**
 * Curated catalog of RSS / Atom feeds the user can pick from. Grouped by
 * category. IDs are stable slugs and used as the storage key in
 * localStorage — never rename an existing id, only add new ones.
 *
 * Iterate freely: add / remove / re-order categories and sources here. The
 * UI re-reads this file at build time.
 */

export type FeedSource = {
  id: string;
  name: string;
  url: string;
  homepage?: string;
  blurb?: string;
};

export type CatalogCategory = {
  id: string;
  label: string;
  blurb?: string;
  sources: FeedSource[];
};

export const CATALOG: CatalogCategory[] = [
  {
    id: "ai-ml",
    label: "ai & ml",
    sources: [
      {
        id: "simon-willison",
        name: "Simon Willison",
        url: "https://simonwillison.net/atom/everything/",
        homepage: "https://simonwillison.net/",
        blurb: "Pragmatic notes from a power user / builder",
      },
      {
        id: "import-ai",
        name: "Import AI (Jack Clark)",
        url: "https://jack-clark.net/feed/",
        homepage: "https://jack-clark.net/",
        blurb: "Weekly digest of frontier AI research",
      },
      {
        id: "sebastian-raschka",
        name: "Sebastian Raschka",
        url: "https://magazine.sebastianraschka.com/feed",
        homepage: "https://magazine.sebastianraschka.com/",
        blurb: "Deep dives into LLMs and training",
      },
      {
        id: "the-gradient",
        name: "The Gradient",
        url: "https://thegradient.pub/rss/",
        homepage: "https://thegradient.pub/",
      },
    ],
  },
  {
    id: "tech",
    label: "tech & engineering",
    sources: [
      {
        id: "hn-frontpage",
        name: "Hacker News",
        url: "https://hnrss.org/frontpage",
        homepage: "https://news.ycombinator.com/",
        blurb: "Front page (community RSS bridge)",
      },
      {
        id: "lobsters",
        name: "Lobsters",
        url: "https://lobste.rs/rss",
        homepage: "https://lobste.rs/",
      },
      {
        id: "ars-technica",
        name: "Ars Technica",
        url: "https://feeds.arstechnica.com/arstechnica/index",
        homepage: "https://arstechnica.com/",
      },
      {
        id: "stratechery",
        name: "Stratechery",
        url: "https://stratechery.com/feed/",
        homepage: "https://stratechery.com/",
        blurb: "Ben Thompson on tech strategy (paywall, headlines free)",
      },
      {
        id: "dhh-hey",
        name: "DHH — HEY World",
        url: "https://world.hey.com/dhh/feed.atom",
        homepage: "https://world.hey.com/dhh",
      },
    ],
  },
  {
    id: "ideas",
    label: "ideas & long-form",
    sources: [
      {
        id: "new-yorker",
        name: "The New Yorker",
        url: "https://www.newyorker.com/feed/everything",
        homepage: "https://www.newyorker.com/",
      },
      {
        id: "aeon",
        name: "Aeon",
        url: "https://aeon.co/feed.rss",
        homepage: "https://aeon.co/",
      },
      {
        id: "quanta",
        name: "Quanta Magazine",
        url: "https://api.quantamagazine.org/feed/",
        homepage: "https://www.quantamagazine.org/",
      },
      {
        id: "the-atlantic",
        name: "The Atlantic",
        url: "https://www.theatlantic.com/feed/all/",
        homepage: "https://www.theatlantic.com/",
      },
      {
        id: "asterisk",
        name: "Asterisk Magazine",
        url: "https://asteriskmag.com/feed.xml",
        homepage: "https://asteriskmag.com/",
      },
    ],
  },
  {
    id: "macro",
    label: "macro & economics",
    sources: [
      {
        id: "marginal-revolution",
        name: "Marginal Revolution",
        url: "https://marginalrevolution.com/feed",
        homepage: "https://marginalrevolution.com/",
        blurb: "Tyler Cowen + Alex Tabarrok",
      },
      {
        id: "noahpinion",
        name: "Noahpinion",
        url: "https://www.noahpinion.blog/feed",
        homepage: "https://www.noahpinion.blog/",
      },
      {
        id: "slow-boring",
        name: "Slow Boring",
        url: "https://www.slowboring.com/feed",
        homepage: "https://www.slowboring.com/",
        blurb: "Matthew Yglesias",
      },
      {
        id: "construction-physics",
        name: "Construction Physics",
        url: "https://www.construction-physics.com/feed",
        homepage: "https://www.construction-physics.com/",
        blurb: "Brian Potter — how the built world works",
      },
    ],
  },
  {
    id: "personal",
    label: "indie blogs",
    sources: [
      {
        id: "patrick-collison",
        name: "Patrick Collison",
        url: "https://patrickcollison.com/feed",
        homepage: "https://patrickcollison.com/",
      },
      {
        id: "dan-luu",
        name: "Dan Luu",
        url: "https://danluu.com/atom.xml",
        homepage: "https://danluu.com/",
      },
      {
        id: "julia-evans",
        name: "Julia Evans",
        url: "https://jvns.ca/atom.xml",
        homepage: "https://jvns.ca/",
        blurb: "Systems & dev tools, told plainly",
      },
      {
        id: "gwern",
        name: "Gwern",
        url: "https://gwern.net/index.rss",
        homepage: "https://gwern.net/",
      },
      {
        id: "paul-graham",
        name: "Paul Graham essays",
        url: "https://www.aaronsw.com/2002/feeds/pgessays.rss",
        homepage: "https://paulgraham.com/articles.html",
        blurb: "Community-maintained feed (Aaron Swartz, originally)",
      },
    ],
  },
  {
    id: "news",
    label: "news (intl)",
    sources: [
      {
        id: "bbc-world",
        name: "BBC News",
        url: "https://feeds.bbci.co.uk/news/world/rss.xml",
        homepage: "https://www.bbc.com/news",
      },
      {
        id: "guardian-world",
        name: "The Guardian",
        url: "https://www.theguardian.com/world/rss",
        homepage: "https://www.theguardian.com/international",
      },
      {
        id: "nyt-world",
        name: "NYT World",
        url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        homepage: "https://www.nytimes.com/section/world",
      },
      {
        id: "ft-home",
        name: "Financial Times",
        url: "https://www.ft.com/rss/home",
        homepage: "https://www.ft.com/",
        blurb: "Paywalled — headlines free",
      },
      {
        id: "economist-latest",
        name: "The Economist",
        url: "https://www.economist.com/latest/rss.xml",
        homepage: "https://www.economist.com/",
        blurb: "Latest across all sections — paywalled, headlines free",
      },
      {
        id: "wsj-world",
        name: "WSJ — World News",
        url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
        homepage: "https://www.wsj.com/news/world",
        blurb: "Paywalled — headlines free",
      },
    ],
  },
  {
    id: "norge",
    label: "norge",
    sources: [
      {
        id: "nrk-toppsaker",
        name: "NRK — toppsaker",
        url: "https://www.nrk.no/toppsaker.rss",
        homepage: "https://www.nrk.no/",
      },
      {
        id: "aftenposten",
        name: "Aftenposten",
        url: "https://www.aftenposten.no/rss",
        homepage: "https://www.aftenposten.no/",
      },
      {
        id: "dn",
        name: "Dagens Næringsliv",
        url: "https://www.dn.no/rss",
        homepage: "https://www.dn.no/",
      },
      {
        id: "vg-forsiden",
        name: "VG",
        url: "https://www.vg.no/rss/feed/forsiden/",
        homepage: "https://www.vg.no/",
      },
    ],
  },
];

// Flat lookup for resolving an id back to a FeedSource.
const ALL_SOURCES = CATALOG.flatMap((c) => c.sources);
const BY_ID = new Map(ALL_SOURCES.map((s) => [s.id, s] as const));

export function getSourceById(id: string): FeedSource | undefined {
  return BY_ID.get(id);
}
