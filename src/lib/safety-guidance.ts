export function safetyGuidance(shaking: boolean) {
  if (shaking) {
    return {
      mode: "shelter" as const,
      title: "Drop, Cover, and Hold On",
      detail:
        "The ground is marked as shaking. Stay under cover. This app will not start an evacuation route during shaking.",
      route: null,
    };
  }
  return {
    mode: "unverified" as const,
    title: "ROUTE UNVERIFIED — FOLLOW TRAINED PERSONNEL",
    detail:
      "No school-verified evacuation route is available. The shortest illustrated path is not a safe route.",
    route: null,
  };
}
