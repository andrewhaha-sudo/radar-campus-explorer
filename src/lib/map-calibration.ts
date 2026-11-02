import { scenes } from "../components/map/campus-data.ts";
import type { Point } from "../components/map/navigation.ts";

export interface CalibrationPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  x: number;
  y: number;
}

export interface MapCalibration {
  points: CalibrationPoint[];
  demo?: boolean;
}

export interface Affine {
  x: [number, number, number];
  y: [number, number, number];
}

export type CalibrationIssue =
  | "calibration_required"
  | "invalid_points"
  | "collinear"
  | "out_of_range";

const STORAGE_KEY = "campus-explorer-map-calibration";

export const CAMPUS_PIXEL_WIDTH = scenes.campus.imageWidth;
export const CAMPUS_PIXEL_HEIGHT = scenes.campus.imageHeight;
export const DEMO_PIXELS_PER_METER = 8;
const METERS_PER_DEGREE_LAT = 111_320;

export const emptyCalibration = (): MapCalibration => ({ points: [] });

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function finite(value: number) {
  return typeof value === "number" && Number.isFinite(value);
}

function triangleArea(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  return Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
}

function solve3(matrix: number[][], rhs: number[]) {
  const rows = matrix.map((row, index) => [...row, rhs[index]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++)
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
        pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-12) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const scale = rows[column][column];
    for (let cell = column; cell < 4; cell++) rows[column][cell] /= scale;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let cell = column; cell < 4; cell++)
        rows[row][cell] -= factor * rows[column][cell];
    }
  }
  return [rows[0][3], rows[1][3], rows[2][3]] as [number, number, number];
}

function fitAxis(
  points: CalibrationPoint[],
  axis: "x" | "y",
): [number, number, number] | null {
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const target = [0, 0, 0];
  for (const point of points) {
    const row = [point.longitude, point.latitude, 1];
    const value = point[axis];
    for (let i = 0; i < 3; i++) {
      target[i] += row[i] * value;
      for (let j = 0; j < 3; j++) normal[i][j] += row[i] * row[j];
    }
  }
  return solve3(normal, target);
}

export function pointIssues(point: CalibrationPoint): string | null {
  if (
    !finite(point.latitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    !finite(point.longitude) ||
    point.longitude < -180 ||
    point.longitude > 180
  )
    return "Enter a real latitude and longitude for every calibration point.";
  if (
    !finite(point.x) ||
    !finite(point.y) ||
    point.x < 0 ||
    point.y < 0 ||
    point.x > CAMPUS_PIXEL_WIDTH ||
    point.y > CAMPUS_PIXEL_HEIGHT
  )
    return "Map X and Y must be pixels on the outdoor campus artwork.";
  return null;
}

export function fitAffine(
  points: CalibrationPoint[],
): { ok: true; affine: Affine } | { ok: false; reason: CalibrationIssue } {
  if (points.length < 3) return { ok: false, reason: "calibration_required" };
  if (points.some((point) => pointIssues(point)))
    return { ok: false, reason: "invalid_points" };
  const [a, b, c] = points;
  const geographic = triangleArea(
    a.longitude,
    a.latitude,
    b.longitude,
    b.latitude,
    c.longitude,
    c.latitude,
  );
  const pixels = triangleArea(a.x, a.y, b.x, b.y, c.x, c.y);
  if (geographic < 1e-12 || pixels < 40)
    return { ok: false, reason: "collinear" };
  const x = fitAxis(points, "x");
  const y = fitAxis(points, "y");
  if (!x || !y) return { ok: false, reason: "collinear" };
  return { ok: true, affine: { x, y } };
}

export function projectAffine(affine: Affine, latitude: number, longitude: number) {
  return {
    x: affine.x[0] * longitude + affine.x[1] * latitude + affine.x[2],
    y: affine.y[0] * longitude + affine.y[1] * latitude + affine.y[2],
  };
}

export function geographicToPixel(
  latitude: number,
  longitude: number,
  calibration: MapCalibration,
): { ok: true; point: Point } | { ok: false; reason: CalibrationIssue } {
  const fitted = fitAffine(calibration.points);
  if (!fitted.ok) return fitted;
  if (!finite(latitude) || !finite(longitude))
    return { ok: false, reason: "invalid_points" };
  const point = projectAffine(fitted.affine, latitude, longitude);
  const margin = 40;
  if (
    point.x < -margin ||
    point.y < -margin ||
    point.x > CAMPUS_PIXEL_WIDTH + margin ||
    point.y > CAMPUS_PIXEL_HEIGHT + margin
  )
    return { ok: false, reason: "out_of_range" };
  return { ok: true, point };
}

export function pixelToGeographic(
  point: Point,
  calibration: MapCalibration,
):
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: CalibrationIssue } {
  const fitted = fitAffine(calibration.points);
  if (!fitted.ok) return fitted;
  const [a, b, c] = fitted.affine.x;
  const [d, e, f] = fitted.affine.y;
  const determinant = a * e - b * d;
  if (Math.abs(determinant) < 1e-12) return { ok: false, reason: "collinear" };
  const x = point.x - c;
  const y = point.y - f;
  const longitude = (e * x - b * y) / determinant;
  const latitude = (a * y - d * x) / determinant;
  if (!finite(latitude) || !finite(longitude))
    return { ok: false, reason: "invalid_points" };
  return { ok: true, latitude, longitude };
}

export function calibrationReady(calibration: MapCalibration) {
  return fitAffine(calibration.points).ok;
}

export function pixelAxes(
  calibration: MapCalibration,
  latitude: number,
  longitude: number,
): { north: Point; east: Point } | null {
  const fitted = fitAffine(calibration.points);
  if (!fitted.ok) return null;
  const origin = projectAffine(fitted.affine, latitude, longitude);
  const northPoint = projectAffine(fitted.affine, latitude + 0.0001, longitude);
  const eastPoint = projectAffine(fitted.affine, latitude, longitude + 0.0001);
  return {
    north: { x: northPoint.x - origin.x, y: northPoint.y - origin.y },
    east: { x: eastPoint.x - origin.x, y: eastPoint.y - origin.y },
  };
}

export function metersPerPixel(
  calibration: MapCalibration,
  latitude: number,
  longitude: number,
) {
  const axes = pixelAxes(calibration, latitude, longitude);
  if (!axes) return null;
  const northPixels = Math.hypot(axes.north.x, axes.north.y);
  const meters = 11.132;
  if (northPixels < 0.01) return null;
  return meters / northPixels;
}

export function demoCalibrationFromHere(
  latitude: number,
  longitude: number,
  anchor: Point,
): { ok: true; calibration: MapCalibration } | { ok: false; reason: string } {
  if (
    !finite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !finite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    return { ok: false, reason: "The current location could not be read." };
  if (
    !finite(anchor.x) ||
    !finite(anchor.y) ||
    anchor.x < 0 ||
    anchor.y < 0 ||
    anchor.x > CAMPUS_PIXEL_WIDTH ||
    anchor.y > CAMPUS_PIXEL_HEIGHT
  )
    return {
      ok: false,
      reason: "Stand on the outdoor campus before saving a demo location.",
    };
  for (const meters of [25, 20, 15, 10, 8]) {
    const pixels = meters * DEMO_PIXELS_PER_METER;
    const xSign =
      anchor.x + pixels <= CAMPUS_PIXEL_WIDTH
        ? 1
        : anchor.x - pixels >= 0
          ? -1
          : 0;
    const ySign =
      anchor.y - pixels >= 0 ? -1 : anchor.y + pixels <= CAMPUS_PIXEL_HEIGHT ? 1 : 0;
    if (!xSign || !ySign) continue;
    const lonDelta =
      (meters / (METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180))) *
      xSign;
    const latDelta = (meters / METERS_PER_DEGREE_LAT) * (ySign < 0 ? 1 : -1);
    const points: CalibrationPoint[] = [
      {
        id: "demo-here",
        label: "DEMO current location",
        latitude,
        longitude,
        x: anchor.x,
        y: anchor.y,
      },
      {
        id: "demo-across",
        label: xSign > 0 ? "DEMO east" : "DEMO west",
        latitude,
        longitude: longitude + lonDelta,
        x: anchor.x + xSign * pixels,
        y: anchor.y,
      },
      {
        id: "demo-along",
        label: ySign < 0 ? "DEMO north" : "DEMO south",
        latitude: latitude + latDelta,
        longitude,
        x: anchor.x,
        y: anchor.y + ySign * pixels,
      },
    ];
    if (calibrationReady({ points }))
      return { ok: true, calibration: { points, demo: true } };
  }
  return {
    ok: false,
    reason:
      "The character is too close to the edge of the map. Walk toward the middle of the outdoor campus and try again.",
  };
}

export function readCalibration(store?: KeyValueStore | null): MapCalibration {
  const storage = store === undefined ? browserStore() : store;
  if (!storage) return emptyCalibration();
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as
      | MapCalibration
      | null;
    if (!parsed || !Array.isArray(parsed.points)) return emptyCalibration();
    const points = parsed.points.filter(
      (point): point is CalibrationPoint =>
        Boolean(point) &&
        typeof point.id === "string" &&
        typeof point.label === "string" &&
        finite(point.latitude) &&
        finite(point.longitude) &&
        finite(point.x) &&
        finite(point.y),
    );
    const calibration = { points, demo: parsed.demo === true };
    return calibrationReady(calibration) ? calibration : emptyCalibration();
  } catch {
    return emptyCalibration();
  }
}

export function writeCalibration(
  calibration: MapCalibration,
  store?: KeyValueStore | null,
) {
  const storage = store === undefined ? browserStore() : store;
  if (!storage) return;
  if (!calibration.points.length) {
    storage.removeItem(STORAGE_KEY);
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(calibration));
}

function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
