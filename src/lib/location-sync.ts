import type { Direction } from "./student-profile.ts";
import {
  geographicToPixel,
  metersPerPixel,
  pixelAxes,
  type MapCalibration,
} from "./map-calibration.ts";
import type { Point } from "../components/map/navigation.ts";

export interface GeoReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
  heading: number | null;
}

export type GpsStatus =
  | "disabled"
  | "requesting_permission"
  | "locating"
  | "connected"
  | "low_accuracy"
  | "unavailable"
  | "permission_denied"
  | "calibration_required";

export const GPS_STATUS_LABEL: Record<GpsStatus, string> = {
  disabled: "GPS Disabled",
  requesting_permission: "Requesting Permission",
  locating: "Locating",
  connected: "GPS Connected",
  low_accuracy: "Low Accuracy",
  unavailable: "GPS Signal Unavailable",
  permission_denied: "Permission Denied",
  calibration_required: "Map Calibration Required",
};

export const RELIABLE_ACCURACY_METERS = 25;
export const FOLLOW_ACCURACY_METERS = 65;
export const STALE_FIX_MS = 20_000;
export const JUMP_METERS = 120;
export const JUMP_WINDOW_MS = 3_000;
/** Lodestar shows a live marker for 3s, then a stale marker until 10s. */
export const FRESH_FIX_MS = 3_000;
export const SHOW_FIX_MS = 10_000;
/** Lodestar asks again when no fix arrives for 2 seconds. */
export const HEARTBEAT_GAP_MS = 2_000;
const DERIVED_SPEED_CAP_MPS = 5;
/** A tight phone ignores about a third of its accuracy, never less than 1.2 m or more than 8 m. */
export const TRUST_ACCURACY_METERS = 8;

export function noiseFloorMeters(accuracy: number) {
  if (!Number.isFinite(accuracy) || accuracy < 0) return 1.2;
  return Math.min(8, Math.max(1.2, accuracy * 0.35));
}

export interface GpsMoveGate {
  accept: boolean;
  meters: number;
  reason: "first" | "trusted" | "clear_step" | "jitter";
}

export interface FixAssessment {
  quality: "reliable" | "approximate" | "rejected";
  reason:
    | "ok"
    | "low_accuracy"
    | "stale"
    | "implausible_jump"
    | "incomplete";
}

interface WatchPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number | null;
    heading?: number | null;
  };
  timestamp: number;
}

export interface GeolocationSource {
  watchPosition(
    success: (position: WatchPosition) => void,
    error: (error: { code: number; message: string }) => void,
    options: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

export function readingFromPosition(position: WatchPosition): GeoReading {
  const speed = position.coords.speed;
  const heading = position.coords.heading;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
    speed: typeof speed === "number" && Number.isFinite(speed) ? speed : null,
    heading:
      typeof heading === "number" && Number.isFinite(heading) ? heading : null,
  };
}

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const radius = 6_371_000;
  const from = (a.latitude * Math.PI) / 180;
  const to = (b.latitude * Math.PI) / 180;
  const dLat = to - from;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from) * Math.cos(to) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function assessFix(
  reading: GeoReading,
  previousReliable: GeoReading | null,
  now: number,
): FixAssessment {
  if (
    !Number.isFinite(reading.latitude) ||
    !Number.isFinite(reading.longitude) ||
    !Number.isFinite(reading.accuracy) ||
    reading.accuracy < 0 ||
    !Number.isFinite(reading.timestamp)
  )
    return { quality: "rejected", reason: "incomplete" };
  const age = now - reading.timestamp;
  if (age > STALE_FIX_MS || age < -5_000)
    return { quality: "rejected", reason: "stale" };
  if (
    previousReliable &&
    reading.timestamp >= previousReliable.timestamp &&
    reading.timestamp - previousReliable.timestamp <= JUMP_WINDOW_MS &&
    distanceMeters(previousReliable, reading) > JUMP_METERS
  )
    return { quality: "rejected", reason: "implausible_jump" };
  if (reading.accuracy > FOLLOW_ACCURACY_METERS)
    return { quality: "rejected", reason: "low_accuracy" };
  if (reading.accuracy > RELIABLE_ACCURACY_METERS)
    return { quality: "approximate", reason: "low_accuracy" };
  return { quality: "reliable", reason: "ok" };
}

const PREDICT_MAX_MS = 2_000;

export type FixClock = "fresh" | "stale" | "hidden";

export function fixClock(timestamp: number, now: number): FixClock {
  const age = now - timestamp;
  if (!Number.isFinite(age)) return "hidden";
  if (age <= FRESH_FIX_MS) return "fresh";
  if (age <= SHOW_FIX_MS) return "stale";
  return "hidden";
}

export function shouldHeartbeat(
  lastAttemptAt: number,
  now: number,
  inFlight: boolean,
) {
  return !inFlight && now - lastAttemptAt >= HEARTBEAT_GAP_MS;
}

export function acceptNewerFix(
  previous: GeoReading | null,
  next: GeoReading,
) {
  if (!previous) return true;
  return next.timestamp >= previous.timestamp;
}

export function readingWithMotion(
  previous: GeoReading | null,
  next: GeoReading,
): GeoReading {
  if (!previous || next.timestamp <= previous.timestamp) return next;
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0 || seconds > FRESH_FIX_MS / 1000) return next;
  const meters = distanceMeters(previous, next);
  const derivedSpeed = meters / seconds;
  const speed =
    next.speed ??
    (derivedSpeed <= DERIVED_SPEED_CAP_MPS ? derivedSpeed : null);
  if (next.heading !== null || speed === null || speed < 0.4) {
    return speed === next.speed ? next : { ...next, speed };
  }
  const north = (next.latitude - previous.latitude) * 111_320;
  const east =
    (next.longitude - previous.longitude) *
    111_320 *
    Math.cos((previous.latitude * Math.PI) / 180);
  const heading = (Math.atan2(east, north) * 180) / Math.PI;
  return { ...next, speed, heading: (heading + 360) % 360 };
}

export function predictReading(reading: GeoReading, now: number) {
  const age = Math.min(PREDICT_MAX_MS, Math.max(0, now - reading.timestamp));
  const speed = reading.speed;
  const heading = reading.heading;
  if (
    speed === null ||
    heading === null ||
    speed < 0.4 ||
    age === 0
  )
    return { latitude: reading.latitude, longitude: reading.longitude };
  const distance = speed * (age / 1000);
  const radians = (heading * Math.PI) / 180;
  const latitude =
    reading.latitude + (distance * Math.cos(radians)) / 111_320;
  const longitude =
    reading.longitude +
    (distance * Math.sin(radians)) /
      (111_320 * Math.cos((reading.latitude * Math.PI) / 180));
  return { latitude, longitude };
}

export function gpsMoveGate(
  previous: { latitude: number; longitude: number } | null,
  next: GeoReading,
): GpsMoveGate {
  if (!previous) return { accept: true, meters: 0, reason: "first" };
  const meters = distanceMeters(previous, next);
  const floor = noiseFloorMeters(next.accuracy);
  if (meters < floor) return { accept: false, meters, reason: "jitter" };
  return {
    accept: true,
    meters,
    reason: next.accuracy <= TRUST_ACCURACY_METERS ? "trusted" : "clear_step",
  };
}

export function followTarget(
  reading: GeoReading,
  calibration: MapCalibration,
  now: number,
) {
  if (reading.accuracy > FOLLOW_ACCURACY_METERS) return null;
  if (fixClock(reading.timestamp, now) === "hidden") return null;
  const projected = geographicToPixel(
    reading.latitude,
    reading.longitude,
    calibration,
  );
  return projected.ok ? projected.point : null;
}

export function directionFromHeading(
  heading: number,
  axes: { north: Point; east: Point },
): Direction | null {
  if (!Number.isFinite(heading)) return null;
  const radians = (heading * Math.PI) / 180;
  const dx = Math.sin(radians) * axes.east.x + Math.cos(radians) * axes.north.x;
  const dy = Math.sin(radians) * axes.east.y + Math.cos(radians) * axes.north.y;
  if (Math.hypot(dx, dy) < 1e-6) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export function headingDirection(
  reading: GeoReading,
  calibration: MapCalibration,
): Direction | null {
  if (reading.heading === null) return null;
  const axes = pixelAxes(calibration, reading.latitude, reading.longitude);
  if (!axes) return null;
  return directionFromHeading(reading.heading, axes);
}

export function accuracyRadiusPixels(
  reading: GeoReading,
  calibration: MapCalibration,
) {
  const scale = metersPerPixel(
    calibration,
    reading.latitude,
    reading.longitude,
  );
  if (!scale || scale <= 0) return null;
  const radius = reading.accuracy / scale;
  if (!Number.isFinite(radius) || radius < 6 || radius > 80) return null;
  return radius;
}

export function movementMode(input: {
  enabled: boolean;
  paused: boolean;
  status: GpsStatus;
}): { id: "manual" | "follow" | "approximate"; label: string } {
  if (input.enabled && !input.paused && input.status === "connected")
    return { id: "follow", label: "Location follow" };
  if (input.enabled && !input.paused && input.status === "low_accuracy")
    return { id: "approximate", label: "Approximate location" };
  return { id: "manual", label: "Manual exploration" };
}

export function shouldPublishPose(input: {
  sharing: boolean;
  hidden: boolean;
  gpsEnabled: boolean;
}) {
  return input.sharing && !input.hidden && !input.gpsEnabled;
}

export function browserGeolocation(): GeolocationSource | null {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  const geo = navigator.geolocation;
  return {
    watchPosition: (success, error, options) =>
      geo.watchPosition(
        (position) => success(position),
        (failure) => error(failure),
        options,
      ),
    clearWatch: (id) => geo.clearWatch(id),
  };
}

export function locationIsSecure() {
  return typeof window !== "undefined" && window.isSecureContext;
}

export class LocationWatcher {
  private id: number | null = null;
  private readonly source: GeolocationSource;

  constructor(source: GeolocationSource) {
    this.source = source;
  }

  get active() {
    return this.id !== null;
  }

  start(
    success: (position: WatchPosition) => void,
    error: (error: { code: number; message: string }) => void,
  ) {
    this.stop();
    this.id = this.source.watchPosition(success, error, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 8000,
    });
  }

  stop() {
    if (this.id === null) return;
    this.source.clearWatch(this.id);
    this.id = null;
  }
}
