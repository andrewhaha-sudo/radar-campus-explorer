import { places } from "./campus-data";
import type { Point } from "./navigation";

export function CampusMiniMap({ position }: { position: Point }) {
  return (
    <div className="radar-minimap">
      <div className="radar-minimap-label">
        <span>YOUR POSITION</span>
        <span>ON THIS MAP</span>
      </div>
      <svg
        viewBox="0 0 1254 1254"
        role="img"
        aria-label="Minimap showing your current position on the illustrated campus"
      >
        <image href="/maps/campus.jpg" width="1254" height="1254" />
        {places.map((place) => (
          <rect
            key={place.id}
            x={place.bounds.x}
            y={place.bounds.y}
            width={place.bounds.width}
            height={place.bounds.height}
            fill="none"
            stroke="#416d58"
            strokeWidth="8"
          />
        ))}
        <circle cx={position.x} cy={position.y} r="28" fill="#fff6d9" />
        <circle
          cx={position.x}
          cy={position.y}
          r="16"
          fill="#d17645"
          stroke="#5f4b36"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}
