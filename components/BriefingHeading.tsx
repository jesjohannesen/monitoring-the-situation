type Props = {
  themesHeading: string;
  briefingDate: string;
};

function formatDateLine(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  return `${days[dt.getUTCDay()]} / ${months[dt.getUTCMonth()]} ${dt.getUTCDate()} / ${dt.getUTCFullYear()}`;
}

export function BriefingHeading({ themesHeading, briefingDate }: Props) {
  return (
    <div className="mb-4">
      <h1
        className="glow-strong"
        style={{
          fontFamily: "var(--font-display), monospace",
          fontSize: "var(--heading-size)",
          lineHeight: "var(--heading-line-height)",
          letterSpacing: "var(--display-letter-spacing)",
        }}
      >
        {themesHeading}
      </h1>
      <div
        id="briefing-date-line"
        className="mt-3 lowercase"
        style={{
          fontFamily: "var(--font-display), monospace",
          fontSize: "var(--date-size)",
          letterSpacing: "0.04em",
          opacity: 0.6,
          textShadow: "var(--glow-soft)",
        }}
      >
        {formatDateLine(briefingDate)}
      </div>
    </div>
  );
}
