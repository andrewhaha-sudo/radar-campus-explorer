// Characterization tests for the ported 2D annotation engine (Epic E5).
// Lock v1 viewer.js behaviour before any refactor: coords, undo/redo, hit-test,
// JSON export schema 1.0, comment numbering.

import { describe, it, expect } from 'vitest';
import { screenToCanvas, toNorm, fromNorm, calcFitScale, clampScale } from '../../src/lib/engines/2d-annotate/coords';
import { newHistory, pushUndo, undo, redo } from '../../src/lib/engines/2d-annotate/undo';
import { hitTest } from '../../src/lib/engines/2d-annotate/hittest';
import { buildExport, commentNumbers } from '../../src/lib/engines/2d-annotate/export-json';
import { UNDO_CAP, type Annotation } from '../../src/lib/engines/2d-annotate/types';

describe('coords', () => {
	const dims = { width: 1000, height: 800 };

	it('screenToCanvas accounts for CSS scaling of the element', () => {
		// element shown at half size: a click at its centre maps to canvas centre
		const rect = { left: 100, top: 50, width: 500, height: 400 };
		const p = screenToCanvas(100 + 250, 50 + 200, rect, dims);
		expect(p.x).toBeCloseTo(500);
		expect(p.y).toBeCloseTo(400);
	});

	it('toNorm/fromNorm round-trip', () => {
		const n = toNorm(250, 200, 100, 80, dims);
		expect(n).toEqual({ nx: 0.25, ny: 0.25, nw: 0.1, nh: 0.1 });
		const px = fromNorm(n.nx, n.ny, n.nw, n.nh, dims);
		expect(px).toEqual({ x: 250, y: 200, w: 100, h: 80 });
	});

	it('calcFitScale reserves 80px chrome and floors at 0.25', () => {
		expect(calcFitScale(880, 800)).toBeCloseTo(1.0);
		expect(calcFitScale(100, 800)).toBe(0.25); // tiny viewport -> floor
	});

	it('clampScale clamps to [0.25, 5]', () => {
		expect(clampScale(0.1)).toBe(0.25);
		expect(clampScale(9)).toBe(5);
		expect(clampScale(1.5)).toBe(1.5);
	});
});

describe('undo/redo', () => {
	it('pushUndo snapshots and clears redo; undo/redo restore state', () => {
		const h = newHistory();
		let state = [{ v: 1 }];
		pushUndo(h, state);
		state = [{ v: 2 }];
		const back = undo(h, state);
		expect(back).toEqual([{ v: 1 }]);
		const fwd = redo(h, back!);
		expect(fwd).toEqual([{ v: 2 }]);
	});

	it('a new pushUndo clears the redo stack', () => {
		const h = newHistory();
		pushUndo(h, [1]);
		undo(h, [2]); // now redo has an entry
		expect(h.redo.length).toBe(1);
		pushUndo(h, [3]);
		expect(h.redo.length).toBe(0);
	});

	it('undo/redo return null at the ends', () => {
		const h = newHistory();
		expect(undo(h, [1])).toBeNull();
		expect(redo(h, [1])).toBeNull();
	});

	it('caps the undo stack at UNDO_CAP, dropping the oldest', () => {
		const h = newHistory();
		for (let i = 0; i < UNDO_CAP + 10; i++) pushUndo(h, [i]);
		expect(h.undo.length).toBe(UNDO_CAP);
		// oldest dropped: first remaining entry is snapshot #10
		expect(JSON.parse(h.undo[0])).toEqual([10]);
	});
});

describe('hitTest', () => {
	const dims = { width: 1000, height: 1000 };

	it('hits a marker against its body circle ABOVE the stored tip', () => {
		const a: Annotation = { id: 'm1', page: 1, type: 'aed', nx: 0.5, ny: 0.5, nw: 0, nh: 0, color: '#000' };
		// body centre is 24px above tip (500,500) => (500,476)
		expect(hitTest([a], 500, 476, dims)).toBe('m1');
		// the tip itself is ~24px below the body, outside radius+tol
		expect(hitTest([a], 500, 510, dims)).toBeNull();
	});

	it('hits a rect bounding box and respects negative nw/nh', () => {
		const a: Annotation = { id: 'r1', page: 1, type: 'rect', nx: 0.4, ny: 0.4, nw: -0.2, nh: -0.2, color: '#000' };
		expect(hitTest([a], 300, 300, dims)).toBe('r1'); // inside min/max box
		expect(hitTest([a], 50, 50, dims)).toBeNull();
	});

	it('hits a freehand stroke near a segment', () => {
		const a: Annotation = {
			id: 'f1', page: 1, type: 'freehand', nx: 0, ny: 0, nw: 0, nh: 0, color: '#000',
			points: [ [0.1, 0.1], [0.5, 0.5], [0.9, 0.1] ]
		};
		expect(hitTest([a], 300, 300, dims)).toBe('f1'); // on the first segment
		expect(hitTest([a], 800, 800, dims)).toBeNull();
	});

	it('returns the topmost (last) match', () => {
		const a: Annotation = { id: 'r1', page: 1, type: 'rect', nx: 0.1, ny: 0.1, nw: 0.8, nh: 0.8, color: '#000' };
		const b: Annotation = { id: 'r2', page: 1, type: 'rect', nx: 0.2, ny: 0.2, nw: 0.4, nh: 0.4, color: '#000' };
		expect(hitTest([a, b], 400, 400, dims)).toBe('r2');
	});
});

describe('JSON export schema 1.0', () => {
	const anns: Annotation[] = [
		{ id: 'a2', page: 2, type: 'circle', nx: 0.123456, ny: 0.2, nw: 0.1, nh: 0.1, color: '#B22234', createdAt: '2026-01-02T00:00:00Z' },
		{ id: 'a1', page: 1, type: 'comment', nx: 0.5, ny: 0.5, nw: 0, nh: 0, color: '#B22234', text: 'hi', createdAt: '2026-01-01T00:00:00Z' }
	];

	it('groups by ascending page and rounds coords to 4 decimals', () => {
		const env = buildExport('doc1', 'Floor', anns, '2026-06-16T00:00:00Z');
		expect(env.document.totalAnnotations).toBe(2);
		expect(env.document.pages.map((p) => p.pageNumber)).toEqual([1, 2]);
		const circ = env.document.pages[1].annotations[0];
		expect(circ.x).toBe(0.1235); // rounded
		expect(circ).not.toHaveProperty('nx');
	});

	it('omits empty images arrays', () => {
		const withImgs: Annotation[] = [{ ...anns[1], images: [] }];
		const env = buildExport('d', 'n', withImgs, 'now');
		expect(env.document.pages[0].annotations[0].images).toBeUndefined();
	});
});

describe('comment numbering (global by createdAt)', () => {
	it('numbers comments across pages by createdAt order', () => {
		const anns: Annotation[] = [
			{ id: 'cB', page: 2, type: 'comment', nx: 0, ny: 0, nw: 0, nh: 0, color: '#000', createdAt: '2026-01-03T00:00:00Z' },
			{ id: 'cA', page: 1, type: 'comment', nx: 0, ny: 0, nw: 0, nh: 0, color: '#000', createdAt: '2026-01-01T00:00:00Z' },
			{ id: 'r', page: 1, type: 'rect', nx: 0, ny: 0, nw: 0.1, nh: 0.1, color: '#000' }
		];
		const nums = commentNumbers(anns);
		expect(nums.get('cA')).toBe(1);
		expect(nums.get('cB')).toBe(2);
		expect(nums.has('r')).toBe(false);
	});
});
