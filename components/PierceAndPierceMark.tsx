"use client";

/**
 * Embossed Pierce & Pierce business-card mark, tucked into the bottom-right
 * corner of the viewport. CSS-gated to only render under the "paul allen"
 * style — display: none everywhere else. Note the deliberate "AQUISITIONS"
 * misspelling, faithful to the film card.
 */
export function PierceAndPierceMark() {
  return (
    <div className="paul-allen-mark" aria-hidden="true">
      <div className="pp-title">PIERCE &amp; PIERCE</div>
      <div className="pp-subtitle">MERGERS AND AQUISITIONS</div>
    </div>
  );
}
