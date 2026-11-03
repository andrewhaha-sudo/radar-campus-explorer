// Keep the corrected building name consistent on every view of the source art.
export function CampusLabels({ labelled = false }: { labelled?: boolean }) {
  return (
    <g
      aria-label={labelled ? "Building E sign" : undefined}
      pointerEvents="none"
    >
      <rect x="301" y="477" width="87" height="24" fill="#fff6d8" />
      <text
        x="344"
        y="498"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="25"
        textLength="87"
        lengthAdjust="spacingAndGlyphs"
        fill="#181719"
      >
        Bldg. E
      </text>
    </g>
  );
}
