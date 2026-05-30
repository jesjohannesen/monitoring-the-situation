export default function LinksPage() {
  return (
    <main className="min-h-screen w-full flex justify-center px-6 py-16">
      <div className="w-full" style={{ maxWidth: "680px" }}>
        <h1
          className="glow-strong"
          style={{
            fontFamily: "var(--font-display), monospace",
            fontSize: "var(--heading-size)",
            lineHeight: "var(--heading-line-height)",
            letterSpacing: "var(--display-letter-spacing)",
            marginBottom: "16px",
          }}
        >
          links
        </h1>
        <div
          style={{
            fontFamily: "var(--font-ui), monospace",
            fontSize: "14px",
            opacity: 0.6,
          }}
        >
          &gt; coming soon
        </div>
      </div>
    </main>
  );
}
