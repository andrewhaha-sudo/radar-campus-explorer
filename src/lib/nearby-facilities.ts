export interface Facility {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
}
export function validCoordinates(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -85 &&
    lat <= 85 &&
    lon >= -180 &&
    lon <= 180
  );
}
export function parseFacilities(
  value: unknown,
  lat: number,
  lon: number,
): Facility[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("elements" in value) ||
    !Array.isArray(value.elements)
  )
    throw new Error("Invalid facilities response.");
  const result: Facility[] = [];
  for (const item of value.elements.slice(0, 500)) {
    if (!item || typeof item !== "object") continue;
    const y = item.lat ?? item.center?.lat,
      x = item.lon ?? item.center?.lon;
    const kind = item.tags?.amenity;
    if (
      !validCoordinates(y, x) ||
      Math.abs(y - lat) > 0.05 ||
      Math.abs(x - lon) > 0.1 ||
      !["hospital", "police", "fire_station", "school"].includes(kind)
    )
      continue;
    const name =
      typeof item.tags?.name === "string"
        ? item.tags.name.slice(0, 160)
        : kind.replaceAll("_", " ");
    result.push({ id: `${item.type}-${item.id}`, name, kind, lat: y, lon: x });
    if (result.length >= 80) break;
  }
  return result;
}
export async function nearbyFacilities(
  lat: number,
  lon: number,
  signal: AbortSignal,
) {
  if (!validCoordinates(lat, lon))
    throw new Error("Enter valid latitude and longitude.");
  const query = `[out:json][timeout:15];nwr[amenity~"^(hospital|police|fire_station|school)$"](around:1500,${lat},${lon});out center 80;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  if (!response.ok)
    throw new Error("The facilities provider is unavailable. Try again later.");
  return parseFacilities(await response.json(), lat, lon);
}
