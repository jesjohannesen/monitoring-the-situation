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
  return `${days[dt.getUTCDay()]} · ${months[dt.getUTCMonth()]} ${dt.getUTCDate()} · ${dt.getUTCFullYear()}`;
}

export function BriefingHeading({ themesHeading, briefingDate }: Props) {
  return (
    <div className="mb-12">
      <h1
        className="glow-strong"
        style={{
          fontFamily: "var(--font-vt323), monospace",
          fontSize: "64px",
          lineHeight: 1.05,
          letterSpacing: "0.01em",
        }}
      >
        {themesHeading}
      </h1>
      <div
        className="mt-3 lowercase"
        style={{
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: "13px",
          opacity: 0.5,
        }}
      >
        {formatDateLine(briefingDate)}
      </div>
    </div>
  );
}
