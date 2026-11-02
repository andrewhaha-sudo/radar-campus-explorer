export const radarScreens = [
  "campus",
  "hazards",
  "inspect",
  "alerts",
  "safety",
  "sos",
  "people",
  "resources",
  "reports",
] as const;

export type RadarScreen = (typeof radarScreens)[number];

export function parseRoute(hash: string): RadarScreen {
  const id = hash.replace(/^#/, "").trim();
  return radarScreens.includes(id as RadarScreen) ? (id as RadarScreen) : "campus";
}

export function formatRoute(screen: RadarScreen) {
  return `#${screen}`;
}
