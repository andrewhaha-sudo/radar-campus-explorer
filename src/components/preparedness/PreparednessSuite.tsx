import { lazy, Suspense, useState } from "react";
import { PreparednessHub } from "./PreparednessHub";
import { KidsActivities } from "./KidsActivities";
import { SchoolPortal } from "./SchoolPortal";
import "./preparedness.css";
const FacilitiesMap = lazy(() =>
  import("./FacilitiesMap").then((m) => ({ default: m.FacilitiesMap })),
);
const sections = [
  ["learn", "Learn"],
  ["kids", "Children"],
  ["records", "Records"],
  ["school", "School"],
  ["facilities", "Nearby facilities"],
  ["community", "Community"],
  ["emergency", "Help"],
  ["admin", "Admin"],
] as const;
type Section = (typeof sections)[number][0];
export function PreparednessSuite({
  ownerId,
  onSignIn,
  initial = "learn",
}: {
  ownerId: string;
  onSignIn: () => void;
  initial?: Section;
}) {
  const [section, setSection] = useState<Section>(initial);
  return (
    <div className="preparedness-suite">
      <nav className="suite-navigation" aria-label="Preparedness sections">
        {sections.map(([id, label]) => (
          <button
            className="campus-secondary"
            key={id}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {section === "learn" ? (
        <PreparednessHub ownerId={ownerId} />
      ) : section === "kids" ? (
        <KidsActivities ownerId={ownerId} />
      ) : section === "facilities" ? (
        <Suspense fallback={<p role="status">Loading map tools…</p>}>
          <FacilitiesMap />
        </Suspense>
      ) : (
        <SchoolPortal
          key={`${ownerId}:${section}`}
          mode={section}
          onSignIn={onSignIn}
        />
      )}
    </div>
  );
}
