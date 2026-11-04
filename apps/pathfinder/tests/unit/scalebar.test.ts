// Scale bar geometry for the map export (design doc 2026-08-18, plan.scaleBar).
//
// The contract that matters on a life-safety document: a scale bar is a
// measuring instrument printed on a page a responder may trust under pressure.
// It therefore either states a round, checkable real-world length, or it does
// not print at all. There is no third option, and no rounding that flatters the
// page - if the floor has no plan scale, niceScaleLength returns null.

import { describe, it, expect } from 'vitest';
import {
	niceScaleLength,
	realMmPerPageMm,
	scaleBarSegments,
	NICE_MANTISSAS
} from '../../src/lib/engines/map-export/scalebar';

/** True when v is one of {1,2,5,10,25,50,100} times a power of ten. */
function isNiceNumber(v: number): boolean {
	if (!(v > 0) || !Number.isFinite(v)) return false;
	let m = v;
	while (m >= 10) m /= 10;
	while (m < 1) m *= 10;
	// The declared set collapses, over all powers of ten, to these mantissas:
	// 1, 2, 5 and 25 -> 2.5 (since 25 = 2.5 x 10).
	return [1, 2, 2.5, 5].some((x) => Math.abs(m - x) < 1e-9);
}

describe('realMmPerPageMm', () => {
	it('divides the plan width by the printed width', () => {
		// 60 m across a plan printed 300 mm wide: one printed mm is 200 real mm.
		expect(realMmPerPageMm(60000, { widthMm: 300 })).toBeCloseTo(200, 9);
	});

	it('accounts for a crop showing only part of the plan width', () => {
		// The same plan cropped to half its width still fills 300 printed mm, so
		// each printed mm now covers half as much of the world.
		expect(realMmPerPageMm(60000, { widthMm: 300, cropFraction: 0.5 })).toBeCloseTo(100, 9);
	});

	it('treats the scale as already page-relative when no page is given', () => {
		expect(realMmPerPageMm(200)).toBe(200);
	});

	it('returns null for an unknown or nonsensical scale', () => {
		expect(realMmPerPageMm(null)).toBeNull();
		expect(realMmPerPageMm(undefined)).toBeNull();
		expect(realMmPerPageMm(0)).toBeNull();
		expect(realMmPerPageMm(-100)).toBeNull();
		expect(realMmPerPageMm(Number.NaN)).toBeNull();
		expect(realMmPerPageMm(Number.POSITIVE_INFINITY)).toBeNull();
	});

	it('returns null when the printed width is not usable', () => {
		expect(realMmPerPageMm(60000, { widthMm: 0 })).toBeNull();
		expect(realMmPerPageMm(60000, { widthMm: -300 })).toBeNull();
		expect(realMmPerPageMm(60000, { widthMm: 300, cropFraction: 0 })).toBeNull();
		expect(realMmPerPageMm(60000, { widthMm: 300, cropFraction: -1 })).toBeNull();
	});
});

describe('niceScaleLength - refusing to print', () => {
	it('returns null when the floor has no plan scale', () => {
		expect(niceScaleLength(50, null)).toBeNull();
	});

	it('returns null for a zero or negative scale', () => {
		expect(niceScaleLength(50, 0)).toBeNull();
		expect(niceScaleLength(50, -100)).toBeNull();
	});

	it('returns null for a non-finite scale', () => {
		expect(niceScaleLength(50, Number.NaN)).toBeNull();
		expect(niceScaleLength(50, Number.POSITIVE_INFINITY)).toBeNull();
	});

	it('returns null when there is no room on the page for a bar', () => {
		expect(niceScaleLength(0, 100)).toBeNull();
		expect(niceScaleLength(-40, 100)).toBeNull();
		expect(niceScaleLength(Number.NaN, 100)).toBeNull();
	});

	it('returns null when the page cannot be measured', () => {
		expect(niceScaleLength(50, 60000, 'metric', { widthMm: 0 })).toBeNull();
	});
});

describe('niceScaleLength - metric', () => {
	it('picks the exact round length when one fits', () => {
		// 1 printed mm = 100 real mm, so a 50 mm bar is exactly 5 m.
		const bar = niceScaleLength(50, 100);
		expect(bar).not.toBeNull();
		expect(bar!.realWorldMm).toBeCloseTo(5000, 9);
		expect(bar!.barMm).toBeCloseTo(50, 9);
		expect(bar!.label).toBe('5 m');
	});

	it('rounds DOWN to the nice length, never past the space available', () => {
		// 60 mm of page at 1:100 is 6 m; 6 is not a round number, 5 is.
		const bar = niceScaleLength(60, 100)!;
		expect(bar.label).toBe('5 m');
		expect(bar.barMm).toBeCloseTo(50, 9);
		expect(bar.barMm).toBeLessThanOrEqual(60);
	});

	it('uses the 25 step, not only 1/2/5', () => {
		// 30 mm at 1:1000 is 30 m; the nice ladder offers 25 m below it.
		const bar = niceScaleLength(30, 1000)!;
		expect(bar.label).toBe('25 m');
		expect(bar.realWorldMm).toBeCloseTo(25000, 9);
	});

	it('labels sub-metre lengths in millimetres', () => {
		// 1 printed mm = 10 real mm: a 50 mm bar covers 500 mm of the world.
		const bar = niceScaleLength(50, 10)!;
		expect(bar.label).toBe('500 mm');
		expect(bar.realWorldMm).toBeCloseTo(500, 9);
	});

	it('works from a stored plan scale plus the printed page width', () => {
		// 60 m of building across a 300 mm print: 1 printed mm = 200 real mm.
		const bar = niceScaleLength(40, 60000, 'metric', { widthMm: 300 })!;
		expect(bar.realWorldMm).toBeCloseTo(5000, 9);
		expect(bar.barMm).toBeCloseTo(25, 9);
		expect(bar.label).toBe('5 m');
	});

	it('covers less ground when the page shows a half-width crop', () => {
		const full = niceScaleLength(40, 60000, 'metric', { widthMm: 300 })!;
		const half = niceScaleLength(40, 60000, 'metric', { widthMm: 300, cropFraction: 0.5 })!;
		expect(half.realWorldMm).toBeLessThan(full.realWorldMm);
	});

	it('defaults to metric', () => {
		expect(niceScaleLength(50, 100)!.label).toBe(niceScaleLength(50, 100, 'metric')!.label);
	});
});

describe('niceScaleLength - imperial', () => {
	it('picks a round number of feet', () => {
		// 1 printed mm = 1 ft, so 30 mm of page is 30 ft; 25 ft is the nice fit.
		const bar = niceScaleLength(30, 304.8, 'imperial')!;
		expect(bar.label).toBe('25 ft');
		expect(bar.realWorldMm).toBeCloseTo(25 * 304.8, 6);
		expect(bar.barMm).toBeCloseTo(25, 6);
	});

	it('labels sub-foot lengths in whole inches', () => {
		// 1 printed mm = 0.1 ft: a 6 mm bar covers 0.6 ft, so 0.5 ft = 6 in.
		const bar = niceScaleLength(6, 30.48, 'imperial')!;
		expect(bar.label).toBe('6 in');
		expect(bar.realWorldMm).toBeCloseTo(152.4, 6);
	});

	it('never labels an imperial bar in metres', () => {
		const bar = niceScaleLength(70, 500, 'imperial')!;
		expect(bar.label).toMatch(/(ft|in)$/);
	});

	it('covers a different real distance than the metric bar at the same scale', () => {
		const metric = niceScaleLength(50, 100, 'metric')!;
		const imperial = niceScaleLength(50, 100, 'imperial')!;
		expect(imperial.realWorldMm).not.toBeCloseTo(metric.realWorldMm, 3);
	});
});

describe('niceScaleLength - invariants', () => {
	const scales = [0.5, 1, 3.7, 10, 47.3, 100, 763, 2000, 12345, 987654];
	const targets = [8, 17, 25, 40, 63.5, 90, 120];

	it('always chooses a round real-world number, at every scale', () => {
		for (const units of ['metric', 'imperial'] as const) {
			for (const s of scales) {
				for (const t of targets) {
					const bar = niceScaleLength(t, s, units)!;
					expect(bar).not.toBeNull();
					const base = units === 'metric' ? 1000 : 304.8;
					expect(isNiceNumber(bar.realWorldMm / base)).toBe(true);
				}
			}
		}
	});

	it('never draws a bar wider than the space it was given', () => {
		for (const units of ['metric', 'imperial'] as const) {
			for (const s of scales) {
				for (const t of targets) {
					const bar = niceScaleLength(t, s, units)!;
					expect(bar.barMm).toBeLessThanOrEqual(t + 1e-9);
					expect(bar.barMm).toBeGreaterThan(0);
				}
			}
		}
	});

	it('keeps the bar length and the real distance consistent with the scale', () => {
		for (const s of scales) {
			for (const t of targets) {
				const bar = niceScaleLength(t, s)!;
				expect(bar.barMm * s).toBeCloseTo(bar.realWorldMm, 6);
			}
		}
	});

	it('picks the largest nice length that fits, not merely one that fits', () => {
		// The widest gap in the ladder is 2 -> 5, a factor of 2.5, so the next step
		// up from the chosen length must overflow the space by then at the latest.
		for (const s of scales) {
			for (const t of targets) {
				const bar = niceScaleLength(t, s)!;
				expect(bar.barMm * 2.5).toBeGreaterThan(t - 1e-9);
			}
		}
	});

	it('exposes the declared nice ladder', () => {
		expect(NICE_MANTISSAS).toEqual([1, 2, 5, 10, 25, 50, 100]);
	});
});

describe('scaleBarSegments', () => {
	it('splits the bar into equal alternating segments', () => {
		const segs = scaleBarSegments(40, 4);
		expect(segs).toHaveLength(4);
		expect(segs.map((s) => s.filled)).toEqual([true, false, true, false]);
		expect(segs[0]).toMatchObject({ startMm: 0, endMm: 10 });
		expect(segs[3]).toMatchObject({ startMm: 30, endMm: 40 });
	});

	it('ends the last segment exactly on the bar length', () => {
		const segs = scaleBarSegments(37, 3);
		expect(segs[segs.length - 1].endMm).toBeCloseTo(37, 9);
	});

	it('leaves no gap between segments', () => {
		const segs = scaleBarSegments(50, 5);
		for (let i = 1; i < segs.length; i++) {
			expect(segs[i].startMm).toBeCloseTo(segs[i - 1].endMm, 9);
		}
	});

	it('starts filled so the bar reads as a measure, not a rule', () => {
		expect(scaleBarSegments(10, 1)).toEqual([{ startMm: 0, endMm: 10, filled: true }]);
	});

	it('returns nothing for a bar with no length', () => {
		expect(scaleBarSegments(0, 4)).toEqual([]);
		expect(scaleBarSegments(-40, 4)).toEqual([]);
		expect(scaleBarSegments(Number.NaN, 4)).toEqual([]);
	});

	it('returns nothing for a nonsensical segment count', () => {
		expect(scaleBarSegments(40, 0)).toEqual([]);
		expect(scaleBarSegments(40, -2)).toEqual([]);
		expect(scaleBarSegments(40, 2.5)).toEqual([]);
		expect(scaleBarSegments(40, Number.NaN)).toEqual([]);
	});

	it('composes with a chosen bar length', () => {
		const bar = niceScaleLength(50, 100)!;
		const segs = scaleBarSegments(bar.barMm, 4);
		expect(segs[segs.length - 1].endMm).toBeCloseTo(bar.barMm, 9);
	});
});
