import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavMenu } from "@/components/NavMenu";

export const metadata: Metadata = {
  title: "briefing",
  description: "daily briefing",
};

// Inline script — runs before paint to set data-theme from localStorage so
// the page doesn't flash the wrong palette on load.
const noFlashScript = `
(function () {
  try {
    var style = localStorage.getItem('briefing.style');
    var mode  = localStorage.getItem('briefing.mode');

    // Migrate from the older single 'briefing.theme' key.
    if (!style || !mode) {
      var legacy = localStorage.getItem('briefing.theme');
      if (legacy === 'dark')      { style = style || 'hacker';    mode = mode || 'dark';  }
      else if (legacy === 'light'){ style = style || 'hacker';    mode = mode || 'light'; }
      else if (legacy === 'cognition') { style = style || 'cognition'; mode = mode || 'light'; }
    }

    if (style !== 'hacker' && style !== 'cognition' && style !== 'paul-allen') style = 'hacker';
    if (mode  !== 'dark'   && mode  !== 'light')      mode  = 'dark';

    document.documentElement.setAttribute('data-style', style);
    document.documentElement.setAttribute('data-mode',  mode);
    // Back-compat attribute for any legacy CSS / scripts.
    document.documentElement.setAttribute('data-theme', mode);
  } catch (e) {
    document.documentElement.setAttribute('data-style', 'hacker');
    document.documentElement.setAttribute('data-mode',  'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-style="hacker"
      data-mode="dark"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Geist+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400;1,700&family=Marcellus+SC&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=VT323&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>
        <NavMenu />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
