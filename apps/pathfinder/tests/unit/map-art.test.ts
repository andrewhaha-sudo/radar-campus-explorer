// Map export art: header treatments, per-type legend chip icons, hallway areas.
//
// Two v1 behaviours were never ported and were tracked as defects:
//   M4 - every legend chip printed as a plain circle, so the theme's per-type
//        `cell` size ladder was dead weight and v1's icon set was lost.
//   M5 - hallway markers printed as pins instead of the filled, dashed polygon
//        with a centroid label pill that v1 drew (viewer.js:3632-3705).
// Plus the two non-solid header treatments (graph-rule / hazard-stripe) that
// drawHeaderBand implemented but no preset ever selected.
//
// Everything here is asserted through a recording jsPDF stand-in: the contract
// is which draw primitives get issued, and that their geometry comes from the
// theme's tokens rather than from a style branch.

import { describe, it, expect } from 'vitest';
import { buildMapPdf, drawLegendChip } from '../../src/lib/engines/map-export/export-pdf';
import { COMMAND, SAGE, ALERT, DEFAULT_THEME, resolveTheme } from '../../src/lib/engines/map-export/theme';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';

interface Call {
	fn: string;
	args: unknown[];
}

/** Recording stand-in for jsPDF: keeps every call in issue order. */
function artDoc() {
	const calls: Call[] = [];
	const doc: Record<string, unknown> = {};
	const rec =
		(fn: string) =>
		(...args: unknown[]) => {
			calls.push({ fn, args });
			return doc;
		};
	for (const m of [
		'addPage',
		'rect',
		'roundedRect',
		'circle',
		'triangle',
		'line',
		'lines',
		'addImage',
		'setFont',
		'setFontSize',
		'setLineWidth',
		'setLineDashPattern',
		'setFillColor',
		'setDrawColor',
		'setTextColor',
		'setGState',
		'text'
	])
		doc[m] = rec(m);
	// jsPDF's GState is callable without `new`; return the parameters so the
	// recorded setGState call carries the opacity.
	doc.GState = (o: unknown) => o;
	const of = (fn: string) => calls.filter((c) => c.fn === fn);
	return { doc: doc as never, calls, of };
}

const nums = (c: Call) => c.args.filter((a): a is number => typeof a === 'number');

const mk = (over: Partial<MapMarker> = {}): MapMarker => ({
	id: Math.random().toString(36).slice(2),
	type: 'stairs',
	label: 'S1',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

// --- header treatments ------------------------------------------------------

describe('header treatments are preset tokens, not code paths', () => {
	it('Sage carries v1 5mm graph-rule hairlines', () => {
		expect(SAGE.header.treatment).toBe('graph-rule');
		expect(SAGE.header.treatmentColor).toBe('#1C6E5B');
		expect(SAGE.header.treatmentPitchMm).toBe(5);
		expect(SAGE.header.treatmentWidthMm).toBe(0.2);
	});

	it('Alert carries v1 45-degree hazard bars at 8mm pitch', () => {
		expect(ALERT.header.treatment).toBe('hazard-stripe');
		expect(ALERT.header.treatmentColor).toBe('#F07D23');
		expect(ALERT.header.treatmentPitchMm).toBe(8);
		expect(ALERT.header.treatmentWidthMm).toBe(2.5);
	});

	it('Command stays solid, so the default export is unchanged', () => {
		expect(COMMAND.header.treatment).toBe('solid');
		expect(DEFAULT_THEME.header.treatment).toBe('solid');
	});

	const page = {
		page: 1,
		imageDataUrl: 'data:image/jpeg;base64,AAA',
		canvasW: 1000,
		canvasH: 800,
		markers: [mk({})]
	};

	function run(style: 'command' | 'blueprint' | 'field') {
		const rec = artDoc();
		buildMapPdf(() => rec.doc, [page], {}, [mk({})], { facilityName: 'Rock L. Butler' }, style);
		return rec;
	}

	it('Sage rules the header in the treatment ink at the treatment width', () => {
		const { calls } = run('blueprint');
		const i = calls.findIndex((c) => c.fn === 'setDrawColor' && c.args.join(',') === '28,110,91');
		expect(i).toBeGreaterThan(-1);
		expect(calls[i + 1]).toMatchObject({ fn: 'setLineWidth', args: [0.2] });
		// the next runs of calls are the rules themselves, on 5mm pitch
		const rules = calls.slice(i + 2).filter((c) => c.fn === 'line');
		const firstHorizontal = rules.find((c) => nums(c)[1] === nums(c)[3]);
		expect(firstHorizontal && nums(firstHorizontal)[1]).toBe(5);
	});

	it('Alert fills 45-degree bars in the treatment ink', () => {
		const { calls } = run('field');
		const i = calls.findIndex((c) => c.fn === 'setFillColor' && c.args.join(',') === '240,125,35');
		expect(i).toBeGreaterThan(-1);
		expect(calls[i + 1].fn).toBe('triangle');
	});

	it('Command issues neither, because its band is solid', () => {
		const { calls } = run('command');
		expect(calls.some((c) => c.fn === 'setDrawColor' && c.args.join(',') === '28,110,91')).toBe(false);
		expect(calls.some((c) => c.fn === 'setFillColor' && c.args.join(',') === '240,125,35')).toBe(false);
	});
});

// --- legend chip art (defect M4) --------------------------------------------

describe('legend chip art is per type, sized by the theme cell', () => {
	const box = { x: 0, y: 0, w: 7, h: 10 };

	it('a door chip draws a door frame and a knob', () => {
		const { doc, of } = artDoc();
		drawLegendChip(doc, COMMAND, 'door', box, 'A', '#2563EB');
		// container: filled + stroked at the cell's own size
		const shells = of('roundedRect');
		expect(shells.length).toBe(2);
		expect(nums(shells[0]).slice(2, 4)).toEqual([7, 10]);
		// frame is a stroked rect inside the upper part of the cell
		const frame = of('rect');
		expect(frame.length).toBe(1);
		expect(nums(frame[0])[2]).toBeCloseTo(7 * 0.6, 6); // 60% of the cell width
		expect(nums(frame[0])[3]).toBeCloseTo(10 * 0.52, 6); // 52% of its height
		// knob
		const knob = of('circle');
		expect(knob.length).toBe(1);
		expect(nums(knob[0])[2]).toBeCloseTo(0.6, 6);
		expect(of('text')[0].args[0]).toBe('A');
	});

	it('a stairs chip draws a three-step staircase and a divider', () => {
		const { doc, of } = artDoc();
		drawLegendChip(doc, COMMAND, 'stairs', { x: 0, y: 0, w: 11.5, h: 7.5 }, 'S1', '#DC2626');
		expect(of('line').length).toBe(7); // 6 staircase segments + 1 divider
		expect(of('rect').length).toBe(0);
		expect(of('circle').length).toBe(0);
	});

	it('an elevator chip draws up and down chevrons over a rule', () => {
		const { doc, of } = artDoc();
		drawLegendChip(doc, COMMAND, 'elevator', { x: 0, y: 0, w: 8.5, h: 8.5 }, 'E3', '#7C3AED');
		expect(of('line').length).toBe(5); // 2 + 2 chevron arms + 1 rule
		// v1 strips the type prefix from an elevator chip label
		expect(of('text')[0].args[0]).toBe('3');
	});

	it('a hallway chip draws a rounded pill carrying its label', () => {
		const { doc, of } = artDoc();
		drawLegendChip(doc, COMMAND, 'hallway', { x: 0, y: 0, w: 11, h: 6.5 }, 'H1', '#16A34A');
		const pill = of('roundedRect');
		expect(pill.length).toBe(2); // fill + stroke
		expect(nums(pill[0]).slice(4, 6)).toEqual([3.25, 3.25]); // radius = h/2
		expect(of('line').length).toBe(0);
		expect(of('text')[0].args[0]).toBe('H1');
	});

	it('a room chip is drawn the same way as a hallway chip', () => {
		const a = artDoc();
		const b = artDoc();
		drawLegendChip(a.doc, COMMAND, 'hallway', { x: 0, y: 0, w: 16, h: 6.5 }, 'X', '#16A34A');
		drawLegendChip(b.doc, COMMAND, 'room', { x: 0, y: 0, w: 16, h: 6.5 }, 'X', '#16A34A');
		expect(b.calls.map((c) => c.fn)).toEqual(a.calls.map((c) => c.fn));
	});

	it('the per-type cell ladder is live: a bigger cell gives bigger art', () => {
		const small = artDoc();
		const big = artDoc();
		drawLegendChip(small.doc, COMMAND, 'stairs', { x: 0, y: 0, w: 11.5, h: 7.5 }, 'S1', '#DC2626');
		drawLegendChip(big.doc, SAGE, 'stairs', { x: 0, y: 0, w: 18, h: 11 }, 'S1', '#DC2626');
		expect(nums(big.of('line')[0])).not.toEqual(nums(small.of('line')[0]));
		expect(big.calls.map((c) => c.fn)).toEqual(small.calls.map((c) => c.fn));
	});

	it('the container follows the shape token, so Alert chips are diamonds', () => {
		const { doc, of } = artDoc();
		drawLegendChip(doc, ALERT, 'door', { x: 0, y: 0, w: 10, h: 15 }, 'A', '#2563EB');
		expect(of('roundedRect').length).toBe(0);
		expect(of('triangle').length).toBe(2); // filled diamond = two triangles
		expect(of('line').length).toBe(4); // stroked diamond = four edges
		expect(of('rect').length).toBe(1); // the door frame is still drawn
	});

	it('chip ink comes from the theme, not from a hardcoded white', () => {
		const { doc, calls } = artDoc();
		const t = resolveTheme({ legend: { chipText: '#010203' } });
		drawLegendChip(doc, t, 'hallway', { x: 0, y: 0, w: 11, h: 6.5 }, 'H1', '#16A34A');
		expect(calls.some((c) => c.fn === 'setTextColor' && c.args.join(',') === '1,2,3')).toBe(true);
	});

	it('an export draws one chip per legend entry, no longer a plain circle each', () => {
		const markers = [
			mk({ type: 'stairs', label: 'S1' }),
			mk({ type: 'door', label: 'A', nx: 0.2 }),
			mk({ type: 'elevator', label: 'E1', nx: 0.3 })
		];
		const { doc, of } = artDoc();
		buildMapPdf(
			() => doc,
			[{ page: 1, imageDataUrl: 'd', canvasW: 1000, canvasH: 800, markers }],
			{},
			markers,
			{ facilityName: 'X' }
		);
		// the one circle on the page is the door chip's knob
		expect(of('circle').length).toBe(1);
		expect(nums(of('circle')[0])[2]).toBeCloseTo(0.6, 6);
	});
});

// --- hallway polygons (defect M5) -------------------------------------------

describe('hallway markers with a polygon print as an area, not a pin', () => {
	const hall = mk({
		type: 'hallway',
		label: 'H1',
		nx: 0.5,
		ny: 0.5,
		points: [
			{ nx: 0.2, ny: 0.2 },
			{ nx: 0.8, ny: 0.2 },
			{ nx: 0.8, ny: 0.6 },
			{ nx: 0.2, ny: 0.6 }
		]
	});

	function run(markers: MapMarker[]) {
		const rec = artDoc();
		buildMapPdf(
			() => rec.doc,
			[{ page: 1, imageDataUrl: 'd', canvasW: 1000, canvasH: 800, markers }],
			{},
			markers,
			{ facilityName: 'X' }
		);
		return rec;
	}

	it('carries v1 area tokens on the default theme', () => {
		expect(DEFAULT_THEME.hallway.fillOpacity).toBe(0.14);
		expect(DEFAULT_THEME.hallway.borderWidthMm).toBe(0.9);
		expect(DEFAULT_THEME.hallway.dash).toEqual([3.5, 2]);
	});

	it('fills the polygon at the themed opacity and strokes it dashed', () => {
		const { of, calls } = run([hall]);
		const paths = of('lines');
		expect(paths.length).toBe(2); // one fill pass, one stroke pass
		expect(paths[0].args[4]).toBe('F');
		expect(paths[1].args[4]).toBe('S');
		expect(calls.some((c) => c.fn === 'setGState' && JSON.stringify(c.args[0]) === '{"opacity":0.14}')).toBe(
			true
		);
		const dash = of('setLineDashPattern');
		expect(dash[0].args[0]).toEqual([3.5, 2]);
		expect(dash[dash.length - 1].args[0]).toEqual([]); // pattern is cleared again
	});

	it('closes the ring, so the last segment returns to the first vertex', () => {
		const { of } = run([hall]);
		const segs = of('lines')[0].args[0] as number[][];
		expect(segs.length).toBe(4); // 3 vertex-to-vertex hops + the closing hop
		const sum = segs.reduce((a, s) => [a[0] + s[0], a[1] + s[1]], [0, 0]);
		expect(sum[0]).toBeCloseTo(0, 6);
		expect(sum[1]).toBeCloseTo(0, 6);
	});

	it('labels the area with a pill at the centroid, sized by the pill tokens', () => {
		const { of } = run([hall]);
		const pills = of('roundedRect').filter((c) => {
			const n = nums(c);
			return n[2] === DEFAULT_THEME.hallway.pillWMm && n[3] === DEFAULT_THEME.hallway.pillHMm;
		});
		expect(pills.length).toBeGreaterThanOrEqual(2); // fill + stroke (plus shadow)
		expect(of('text').some((c) => c.args[0] === 'H1')).toBe(true);
	});

	it('draws an extra label pin for each operator-placed extra label', () => {
		const withExtras = { ...hall, extraLabels: [{ nx: 0.3, ny: 0.55 }] };
		const one = run([hall]);
		const two = run([withExtras]);
		const count = (r: ReturnType<typeof artDoc>) =>
			r.of('text').filter((c) => c.args[0] === 'H1').length;
		expect(count(two)).toBe(count(one) + 1);
	});

	it('a hallway with no polygon still prints as a pin, unchanged', () => {
		const { of } = run([mk({ type: 'hallway', label: 'H1' })]);
		expect(of('lines').length).toBe(0);
		expect(of('setLineDashPattern').length).toBe(0);
	});

	it('a solid dash token strokes the border without a dash pattern', () => {
		const rec = artDoc();
		buildMapPdf(
			() => rec.doc,
			[{ page: 1, imageDataUrl: 'd', canvasW: 1000, canvasH: 800, markers: [hall] }],
			{},
			[hall],
			{ facilityName: 'X' },
			'command',
			{ hallway: { dash: [0, 0] } }
		);
		expect(rec.of('lines').length).toBe(2);
		expect(rec.of('setLineDashPattern').length).toBe(0);
	});
});
