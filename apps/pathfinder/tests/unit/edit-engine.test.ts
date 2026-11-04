// Unit tests for direct-manipulation editing (E5 drag-move) + crop normalization
// + hallway polygon vertex ops (E6).

import { describe, it, expect } from 'vitest';
import { translateAnnotation, clampAnnotation } from '../../src/lib/engines/2d-annotate/edit';
import type { Annotation } from '../../src/lib/engines/2d-annotate/types';
import { normalizeCrop, MIN_CROP } from '../../src/lib/engines/map-export/layout';
import {
	nearestVertex,
	nearestMidpoint,
	insertMidpoint,
	deleteVertex
} from '../../src/lib/engines/map-export/markers';

const rect: Annotation = { id: 'r', page: 1, type: 'rect', nx: 0.2, ny: 0.2, nw: 0.3, nh: 0.1, color: '#000' };
const free: Annotation = { id: 'f', page: 1, type: 'freehand', nx: 0, ny: 0, nw: 0, nh: 0, color: '#000', points: [[0.1, 0.1], [0.2, 0.2]] };

describe('translate / clamp annotation', () => {
	it('moves a bbox shape by a normalized delta', () => {
		const m = translateAnnotation(rect, 0.1, -0.05);
		expect(m.nx).toBeCloseTo(0.3);
		expect(m.ny).toBeCloseTo(0.15);
		expect(m.nw).toBe(0.3); // size unchanged
	});
	it('translates every freehand point', () => {
		const m = translateAnnotation(free, 0.5, 0.5);
		expect(m.points).toEqual([[0.6, 0.6], [0.7, 0.7]]);
	});
	it('clamps a moved anchor into the page', () => {
		expect(clampAnnotation({ ...rect, nx: -0.3, ny: 1.4 })).toMatchObject({ nx: 0, ny: 1 });
	});
});

describe('crop normalization (E6)', () => {
	it('folds negative width/height to a positive origin', () => {
		expect(normalizeCrop(0.5, 0.5, -0.3, -0.2)).toEqual({ nx: 0.2, ny: 0.3, nw: 0.3, nh: 0.2 });
	});
	it('clamps the box inside the page', () => {
		const c = normalizeCrop(0.8, 0.8, 0.5, 0.5)!;
		expect(c.nx + c.nw).toBeLessThanOrEqual(1.0001);
		expect(c.ny + c.nh).toBeLessThanOrEqual(1.0001);
	});
	it('rejects a crop smaller than MIN_CROP', () => {
		expect(normalizeCrop(0.5, 0.5, MIN_CROP / 2, 0.3)).toBeNull();
	});
});

describe('hallway polygon vertex ops (E6)', () => {
	const square = [
		{ nx: 0, ny: 0 },
		{ nx: 1, ny: 0 },
		{ nx: 1, ny: 1 },
		{ nx: 0, ny: 1 }
	];
	it('finds the nearest vertex within tolerance', () => {
		expect(nearestVertex(square, 0.01, 0.01)).toBe(0);
		expect(nearestVertex(square, 0.5, 0.5)).toBe(-1);
	});
	it('finds the nearest segment midpoint', () => {
		expect(nearestMidpoint(square, 0.5, 0.0)).toBe(0); // midpoint of edge 0-1
	});
	it('inserts a midpoint vertex on a segment', () => {
		const out = insertMidpoint(square, 0);
		expect(out).toHaveLength(5);
		expect(out[1]).toEqual({ nx: 0.5, ny: 0 });
	});
	it('deletes a vertex but never below 3', () => {
		expect(deleteVertex(square, 0)).toHaveLength(3);
		expect(deleteVertex(square.slice(0, 3), 0)).toHaveLength(3); // floor at 3
	});
});
