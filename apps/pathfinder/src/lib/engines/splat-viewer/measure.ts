// 3D viewer - measurement + scene math (Epic E8). Pure, framework-agnostic
// (no THREE, no DOM) so the load-bearing distance/scale/marker-cap/viewpoint
// math is unit-testable. The browser component feeds it raw vec3 tuples from
// Spark raycasts.

export type Vec3 = [number, number, number];

/** Euclidean distance between two world-space points. */
export function distance3d(a: Vec3, b: Vec3): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Convert a raw world-unit distance to a calibrated real-world distance.
 * `unitsPerMeter` is the scan's scale (how many world units equal one metre);
 * a scan exported in metres has unitsPerMeter = 1.
 */
export function toMeters(worldDistance: number, unitsPerMeter: number): number {
	if (unitsPerMeter <= 0) return worldDistance;
	return worldDistance / unitsPerMeter;
}

const FEET_PER_METER = 3.280839895;

/** Human-readable measurement label in both metric and imperial. */
export function formatMeasurement(meters: number): string {
	const m = meters.toFixed(2);
	const ft = (meters * FEET_PER_METER).toFixed(2);
	return `${m} m  (${ft} ft)`;
}

/** Total path length across an ordered list of points (room perimeter etc.). */
export function pathLength(points: Vec3[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) total += distance3d(points[i - 1], points[i]);
	return total;
}
