// Unit tests for the pure 3D viewer engine (Epic E8): measurement, scene marker
// cap/validation, and camera viewpoint interpolation.

import { describe, it, expect } from 'vitest';
import { distance3d, toMeters, formatMeasurement, pathLength } from '../../src/lib/engines/splat-viewer/measure';
import {
	MAX_SCENE_MARKERS,
	canAddMarker,
	validateMarker3d,
	interpolateViewpoint,
	easeInOut,
	tourOrder,
	type Viewpoint
} from '../../src/lib/engines/splat-viewer/markers3d';

describe('measurement', () => {
	it('computes 3D euclidean distance', () => {
		expect(distance3d([0, 0, 0], [3, 4, 0])).toBe(5);
		expect(distance3d([1, 2, 2], [1, 2, 2])).toBe(0);
	});
	it('calibrates world units to metres', () => {
		expect(toMeters(10, 1)).toBe(10);
		expect(toMeters(10, 2)).toBe(5); // 2 world units per metre
		expect(toMeters(10, 0)).toBe(10); // guard: bad scale -> identity
	});
	it('formats both metric and imperial', () => {
		expect(formatMeasurement(1)).toContain('1.00 m');
		expect(formatMeasurement(1)).toContain('3.28 ft');
	});
	it('sums a multi-point path', () => {
		expect(pathLength([[0, 0, 0], [3, 4, 0], [3, 4, 12]])).toBe(17);
	});
});

describe('scene markers', () => {
	it('enforces the scene cap', () => {
		expect(canAddMarker(0)).toBe(true);
		expect(canAddMarker(MAX_SCENE_MARKERS - 1)).toBe(true);
		expect(canAddMarker(MAX_SCENE_MARKERS)).toBe(false);
	});
	it('validates type and position', () => {
		expect(validateMarker3d('aed', [1, 2, 3])).toBeNull();
		expect(validateMarker3d('bogus', [1, 2, 3])).toMatch(/type/);
		expect(validateMarker3d('aed', [1, 2])).toMatch(/tuple/);
		expect(validateMarker3d('aed', [1, 2, NaN])).toMatch(/tuple/);
	});
});

describe('viewpoints', () => {
	const a: Viewpoint = { id: 'a', name: 'Entry', position: [0, 0, 0], target: [0, 0, -1], fov: 60, order: 2 };
	const b: Viewpoint = { id: 'b', name: 'Atrium', position: [10, 0, 0], target: [10, 0, -1], fov: 50, order: 1 };

	it('eases in-out', () => {
		expect(easeInOut(0)).toBe(0);
		expect(easeInOut(1)).toBe(1);
		expect(easeInOut(0.5)).toBeCloseTo(0.5);
	});
	it('interpolates endpoints exactly', () => {
		expect(interpolateViewpoint(a, b, 0).position).toEqual([0, 0, 0]);
		expect(interpolateViewpoint(a, b, 1).position).toEqual([10, 0, 0]);
		expect(interpolateViewpoint(a, b, 1).fov).toBeCloseTo(50);
	});
	it('orders a tour by order then name', () => {
		expect(tourOrder([a, b]).map((v) => v.id)).toEqual(['b', 'a']);
	});
});
