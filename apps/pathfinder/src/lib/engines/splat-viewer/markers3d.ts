// 3D viewer - anchored scene markers + named viewpoints (Epic E8). Pure data +
// validation; the THREE/Spark scene binding lives in the browser component.

import type { Vec3 } from './measure';

/** Sane default cap on markers per scene (canonical: ~25). */
export const MAX_SCENE_MARKERS = 25;

export type Marker3dType =
	| 'aed'
	| 'stairs'
	| 'door'
	| 'exit'
	| 'fire_extinguisher'
	| 'hazard'
	| 'utility'
	| 'note';

export const MARKER3D_TYPES: Marker3dType[] = [
	'aed',
	'stairs',
	'door',
	'exit',
	'fire_extinguisher',
	'hazard',
	'utility',
	'note'
];

export interface Marker3d {
	id: string;
	type: Marker3dType;
	label: string;
	description?: string;
	position: Vec3;
	normal?: Vec3;
	/** Optional camera bookmark to frame this marker. */
	viewpointId?: string | null;
	floor?: number | null;
}

/** Whether another marker may be added without exceeding the scene cap. */
export function canAddMarker(currentCount: number): boolean {
	return currentCount < MAX_SCENE_MARKERS;
}

export function validateMarker3d(type: unknown, position: unknown): string | null {
	if (typeof type !== 'string' || !MARKER3D_TYPES.includes(type as Marker3dType)) {
		return 'Invalid marker type.';
	}
	if (
		!Array.isArray(position) ||
		position.length !== 3 ||
		position.some((n) => typeof n !== 'number' || !Number.isFinite(n))
	) {
		return 'Position must be a finite [x,y,z] tuple.';
	}
	return null;
}

// --- Named viewpoints (camera bookmarks / guided tour) ---

export interface Viewpoint {
	id: string;
	name: string;
	position: Vec3;
	target: Vec3;
	fov: number;
	order?: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
	lerp(a[0], b[0], t),
	lerp(a[1], b[1], t),
	lerp(a[2], b[2], t)
];

/** Smoothstep easing for camera transitions (ease-in-out). */
export function easeInOut(t: number): number {
	const c = Math.min(1, Math.max(0, t));
	return c * c * (3 - 2 * c);
}

/** Interpolate camera between two viewpoints at parameter t in [0,1], eased. */
export function interpolateViewpoint(from: Viewpoint, to: Viewpoint, t: number): {
	position: Vec3;
	target: Vec3;
	fov: number;
} {
	const e = easeInOut(t);
	return {
		position: lerpVec(from.position, to.position, e),
		target: lerpVec(from.target, to.target, e),
		fov: lerp(from.fov, to.fov, e)
	};
}

/** Order viewpoints for a guided tour (by `order`, then name). */
export function tourOrder(viewpoints: Viewpoint[]): Viewpoint[] {
	return viewpoints
		.slice()
		.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.name.localeCompare(b.name));
}
