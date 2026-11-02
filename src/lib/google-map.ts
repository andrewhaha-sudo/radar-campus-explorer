export function googleMapsApiKey() {
  const value = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof value === "string" ? value.trim() : "";
}

export function googleMapView(input: {
  apiKey: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const configured = input.apiKey.trim().length > 0;
  const hasFix =
    input.latitude !== null &&
    input.longitude !== null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);
  const openUrl = hasFix
    ? `https://www.google.com/maps/search/?api=1&query=${input.latitude},${input.longitude}`
    : null;
  if (!configured) return { mode: "not_configured" as const, openUrl };
  if (!hasFix) return { mode: "needs_location" as const, openUrl: null };
  return { mode: "map" as const, openUrl };
}
