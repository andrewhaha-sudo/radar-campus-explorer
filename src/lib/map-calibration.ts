export interface MapPoint {
  x: number;
  y: number;
}

// Keep the previous calibration API readable for stored device references and
// callers upgrading from the first GPS release. New tracking uses calibrate().
export * from "./legacy-map-calibration.ts";
export interface GeoPoint {
  latitude: number;
  longitude: number;
}
export interface ReferencePoint extends MapPoint, GeoPoint {
  label: string;
}
export interface Calibration {
  version: 1;
  image: "/maps/campus.jpg";
  verified: true;
  points: ReferencePoint[];
}
export interface MapAlignment {
  origin: GeoPoint;
  x: [number, number, number];
  y: [number, number, number];
  hull: MapPoint[];
  metersToPixels: number;
  residualMeters: number;
}
export const CALIBRATION_KEY = "campus-explorer-map-calibration-v1";
const R = 6371008.8;
const radians = Math.PI / 180;

// A local tangent plane is appropriate for a school-sized area. The affine
// alignment then handles image rotation, independent axis scales and shear.
export function localMeters(point: GeoPoint, origin: GeoPoint): MapPoint {
  return {
    x:
      R *
      (point.longitude - origin.longitude) *
      radians *
      Math.cos(origin.latitude * radians),
    y: R * (point.latitude - origin.latitude) * radians,
  };
}
export function validGeo(point: GeoPoint) {
  return (
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) < 85 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}
const cross = (a: MapPoint, b: MapPoint, c: MapPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function convexHull(points: MapPoint[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: MapPoint[]) => {
    const result: MapPoint[] = [];
    for (const p of list) {
      while (
        result.length >= 2 &&
        cross(result.at(-2)!, result.at(-1)!, p) <= 0
      )
        result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}
export function insideCalibration(point: MapPoint, alignment: MapAlignment) {
  return alignment.hull.every(
    (a, i, hull) => cross(a, hull[(i + 1) % hull.length], point) >= -0.001,
  );
}
export function projectLocation(
  point: GeoPoint,
  alignment: MapAlignment,
): MapPoint {
  const p = localMeters(point, alignment.origin);
  return {
    x: alignment.x[0] * p.x + alignment.x[1] * p.y + alignment.x[2],
    y: alignment.y[0] * p.x + alignment.y[1] * p.y + alignment.y[2],
  };
}
export function projectHeading(heading: number, alignment: MapAlignment) {
  const east = Math.sin(heading * radians),
    north = Math.cos(heading * radians);
  const dx = alignment.x[0] * east + alignment.x[1] * north;
  const dy = alignment.y[0] * east + alignment.y[1] * north;
  return Math.atan2(dy, dx) / radians + 90; // SVG arrow points up at zero.
}
export function calibrate(input: Calibration): MapAlignment {
  if (
    !input ||
    input.version !== 1 ||
    input.image !== "/maps/campus.jpg" ||
    input.verified !== true ||
    !Array.isArray(input.points) ||
    input.points.length < 3 ||
    input.points.length > 12
  )
    throw new Error(
      "Use 3–12 verified reference points for this campus image.",
    );
  const points = input.points;
  if (
    points.some(
      (p) =>
        !p ||
        !validGeo(p) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1254 ||
        p.y < 0 ||
        p.y > 1254 ||
        typeof p.label !== "string" ||
        !p.label.trim() ||
        p.label.length > 120,
    )
  )
    throw new Error(
      "Each point needs a reference name, valid latitude/longitude, and image X/Y from 0 to 1254.",
    );
  const origin = {
    latitude: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
    longitude: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
  };
  const meters = points.map((p) => localMeters(p, origin));
  if (meters.some((p) => Math.hypot(p.x, p.y) > 5000))
    throw new Error(
      "Reference points must describe one campus, within 5 km of their center.",
    );
  const xx = meters.reduce((s, p) => s + p.x * p.x, 0);
  const yy = meters.reduce((s, p) => s + p.y * p.y, 0);
  const xy = meters.reduce((s, p) => s + p.x * p.y, 0);
  const det = xx * yy - xy * xy;
  if (xx + yy < 100 || det / (xx + yy) ** 2 < 0.0025)
    throw new Error(
      "Spread reference points around the campus, at least 10 meters apart and away from a single straight line.",
    );
  const fit = (field: "x" | "y"): [number, number, number] => {
    const mean = points.reduce((s, p) => s + p[field], 0) / points.length;
    const ex = meters.reduce(
      (s, p, i) => s + p.x * (points[i][field] - mean),
      0,
    );
    const ny = meters.reduce(
      (s, p, i) => s + p.y * (points[i][field] - mean),
      0,
    );
    return [(ex * yy - ny * xy) / det, (ny * xx - ex * xy) / det, mean];
  };
  const x = fit("x"),
    y = fit("y");
  const sum = x[0] ** 2 + x[1] ** 2 + y[0] ** 2 + y[1] ** 2;
  const determinant = x[0] * y[1] - x[1] * y[0];
  const high = Math.sqrt(
    (sum + Math.sqrt(Math.max(0, sum ** 2 - 4 * determinant ** 2))) / 2,
  );
  const low = Math.abs(determinant) / high;
  if (!Number.isFinite(high) || low < 0.01 || low / high < 0.05)
    throw new Error(
      "The image points are too close or nearly in a straight line. Check their X/Y positions.",
    );
  const result: MapAlignment = {
    origin,
    x,
    y,
    hull: convexHull(points),
    metersToPixels: high,
    residualMeters: 0,
  };
  result.residualMeters = Math.sqrt(
    points.reduce((s, p) => {
      const projected = projectLocation(p, result);
      return (
        s + ((projected.x - p.x) ** 2 + (projected.y - p.y) ** 2) / low ** 2
      );
    }, 0) / points.length,
  );
  if (result.residualMeters > 8)
    throw new Error(
      "The reference points disagree by more than 8 meters. Recheck the coordinates and image alignment.",
    );
  return result;
}

export function loadCalibration(): Calibration | null {
  try {
    const value = JSON.parse(localStorage.getItem(CALIBRATION_KEY) || "null");
    if (!value) return null;
    calibrate(value);
    return value;
  } catch {
    return null;
  }
}
export function saveCalibration(value: Calibration) {
  calibrate(value);
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(value));
}
export function clearSavedCalibration() {
  localStorage.removeItem(CALIBRATION_KEY);
  localStorage.removeItem("campus-explorer-map-calibration");
}
