export default function LinksPage() {
  return (
    <main className="min-h-screen w-full flex justify-center px-6 py-16">
      <div className="w-full" style={{ maxWidth: "680px" }}>
        <h1
          className="glow-strong"
          style={{
            fontFamily: "var(--font-vt323), monospace",
            fontSize: "44px",
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            marginBottom: "16px",
          }}
        >
          links
        </h1>
        <div
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
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
