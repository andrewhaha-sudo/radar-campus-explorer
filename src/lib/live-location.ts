import {
  insideCalibration,
  localMeters,
  projectHeading,
  projectLocation,
  validGeo,
} from "./map-calibration.ts";
import type { GeoPoint, MapAlignment, MapPoint } from "./map-calibration.ts";
import type { Direction } from "./student-profile.ts";

export const ACCURACY_LIMIT = 15;
export const SIGNAL_TIMEOUT = 20_000;
export interface LocationReading extends GeoPoint {
  accuracy: number;
  timestamp: number;
  heading: number | null;
  speed: number | null;
}
export interface ReliableFix {
  reading: LocationReading;
  point: MapPoint;
  direction: Direction;
  heading: number | null;
  moving: boolean;
  smooth: boolean;
}
export type LocationStatus =
  | "inactive"
  | "locating"
  | "live"
  | "uncertain"
  | "outside"
  | "unavailable"
  | "denied"
  | "paused"
  | "unsupported";
export interface FixResult {
  fix: ReliableFix | null;
  status: LocationStatus;
  detail: string;
}
export interface LocationMap {
  accepts: (point: MapPoint) => boolean;
  canInterpolate: (from: MapPoint, to: MapPoint) => boolean;
}
const directionFor = (dx: number, dy: number): Direction =>
  Math.abs(dx) > Math.abs(dy)
    ? dx > 0
      ? "right"
      : "left"
    : dy > 0
      ? "down"
      : "up";

// Only the last reliable reading is kept, in memory. This is a device reading
// filter, never a route generator or a source of invented geographic positions.
export function evaluateLocation(
  reading: LocationReading,
  previous: ReliableFix | null,
  alignment: MapAlignment,
  map: LocationMap,
  now = Date.now(),
): FixResult {
  const keep = (status: LocationStatus, detail: string): FixResult => ({
    fix: previous ? { ...previous, moving: false, smooth: false } : null,
    status,
    detail,
  });
  if (
    !validGeo(reading) ||
    !Number.isFinite(reading.accuracy) ||
    reading.accuracy <= 0 ||
    !Number.isFinite(reading.timestamp) ||
    now - reading.timestamp > 15_000 ||
    reading.timestamp > now + 5000
  )
    return keep(
      "unavailable",
      "Location Signal Unavailable. Waiting for a fresh device reading.",
    );
  if (previous && reading.timestamp <= previous.reading.timestamp)
    return keep("uncertain", "Waiting for a newer location reading.");
  if (reading.accuracy > ACCURACY_LIMIT)
    return keep(
      "uncertain",
      "Location is approximate. Accuracy must be within ±15 m; the last reliable position is preserved.",
    );
  const point = projectLocation(reading, alignment);
  if (!insideCalibration(point, alignment))
    return keep(
      "outside",
      "Outside the calibrated area. The position is not clamped onto campus.",
    );
  if (!map.accepts(point))
    return keep(
      "uncertain",
      "Approximate building or blocked-area location. GPS cannot identify a classroom or floor. Correct manually if needed.",
    );
  let moving = false;
  let smooth = false;
  let direction: Direction = previous?.direction ?? "down";
  let heading: number | null = null;
  if (previous) {
    const delta = localMeters(reading, previous.reading);
    const meters = Math.hypot(delta.x, delta.y);
    const seconds = (reading.timestamp - previous.reading.timestamp) / 1000;
    if (meters > 8 * seconds + reading.accuracy + previous.reading.accuracy)
      return keep(
        "uncertain",
        "A sudden location jump was ignored. Waiting for a consistent reading.",
      );
    const drift = Math.max(
      2,
      Math.min(5, (reading.accuracy + previous.reading.accuracy) / 4),
    );
    if (meters < drift)
      return {
        fix: { ...previous, moving: false, smooth: false },
        status: "live",
        detail: "Connected · approximately stationary",
      };
    moving = true;
    direction = directionFor(
      point.x - previous.point.x,
      point.y - previous.point.y,
    );
    smooth =
      seconds < 10 && meters < 30 && map.canInterpolate(previous.point, point);
  }
  if (
    reading.heading !== null &&
    Number.isFinite(reading.heading) &&
    reading.heading >= 0 &&
    reading.heading < 360 &&
    reading.speed !== null &&
    Number.isFinite(reading.speed) &&
    reading.speed >= 0.5
  ) {
    heading = projectHeading(reading.heading, alignment);
    direction = directionFor(
      Math.sin((heading * Math.PI) / 180),
      -Math.cos((heading * Math.PI) / 180),
    );
  }
  return {
    fix: { reading, point, direction, heading, moving, smooth },
    status: "live",
    detail: "Connected · using device location",
  };
}

// A future configured indoor positioning provider can implement this contract.
// The only installed source is the browser's actual Geolocation API.
export interface LocationSource {
  subscribe(
    onReading: (reading: LocationReading) => void,
    onError: (code: number) => void,
  ): () => void;
}
export const browserLocationSource: LocationSource = {
  subscribe(onReading, onError) {
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) =>
        onReading({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading,
          speed: coords.speed,
          timestamp,
        }),
      (error) => onError(error.code),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  },
};
