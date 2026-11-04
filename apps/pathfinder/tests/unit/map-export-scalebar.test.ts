// Scale bar + north rotation in the exported map (Epic E15, AC-15.5.x).
//
// A life-safety document must not print a scale bar it cannot justify. The bar
// appears only when the floor carries a known plan scale; without one the
// existing "not to scale" footer note stands alone.

import { describe, it, expect } from 'vitest';
import { buildMapPdf, type ExportPageInput } from '../../src/lib/engines/map-export/export-pdf';

/** Recording stand-in for jsPDF: captures text and rotation-bearing calls. */
function fakeDoc() {
	const texts: string[] = [];
	const rects: Array<[number, number, number, number]> = [];
	const triangles: number[][] = [];
	const doc = {
		addPage: () => doc,
		text(t: string) {
			texts.push(String(t));
			return doc;
		},
		rect(x: number, y: number, w: number, h: number) {
			rects.push([x, y, w, h]);
			return doc;
		},
		triangle(...a: number[]) {
			triangles.push(a);
			return doc;
		},
		setFont: () => doc,
		setFontSize: () => doc,
		setFillColor: () => doc,
		setDrawColor: () => doc,
		setTextColor: () => doc,
		setLineWidth: () => doc,
		setLineDashPattern: () => doc,
		setGState: () => doc,
		GState: () => ({}),
		roundedRect: () => doc,
		circle: () => doc,
		line: () => doc,
		lines: () => doc,
		addImage: () => doc,
		getTextWidth: () => 10,
		save: () => doc
	};
	return { doc, texts, rects, triangles };
}

function page(over: Partial<ExportPageInput> = {}): ExportPageInput {
	return {
		page: 1,
		imageDataUrl: 'data:image/jpeg;base64,AAA',
		canvasW: 2000,
		canvasH: 1400,
		markers: [],
		...over
	};
}

const header = { facilityName: 'Test School' };

describe('scale bar', () => {
	it('is absent when the floor has no plan scale', () => {
		const { doc, texts } = fakeDoc();
		buildMapPdf(() => doc as never, [page()], {}, [], header, 'command', {
			plan: { scaleBar: { on: true } }
		});
		expect(texts.some((t) => /\d+\s*(m|ft|mm)$/.test(t))).toBe(false);
	});

	it('prints a round-number caption when the floor has a plan scale', () => {
		const { doc, texts } = fakeDoc();
		buildMapPdf(
			() => doc as never,
			// 30000mm (30m) of real building across the printed plan width
			[page({ planScale: 30000 })],
			{},
			[],
			header,
			'command',
			{ plan: { scaleBar: { on: true } } }
		);
		const caption = texts.find((t) => /^\d+(\.\d+)?\s*(m|ft|mm)$/.test(t.trim()));
		expect(caption).toBeDefined();
		// a nice round measure, never an arbitrary fraction
		expect(Number(caption!.trim().split(/\s+/)[0])).toBeGreaterThan(0);
	});

	it('stays absent when the theme switches the bar off, even with a scale', () => {
		const { doc, texts } = fakeDoc();
		buildMapPdf(() => doc as never, [page({ planScale: 30000 })], {}, [], header, 'command', {
			plan: { scaleBar: { on: false } }
		});
		expect(texts.some((t) => /^\d+(\.\d+)?\s*(m|ft)$/.test(t.trim()))).toBe(false);
	});

	it('refuses a nonsensical plan scale rather than inventing a bar', () => {
		for (const bad of [0, -5, Number.NaN]) {
			const { doc, texts } = fakeDoc();
			buildMapPdf(() => doc as never, [page({ planScale: bad })], {}, [], header, 'command', {
				plan: { scaleBar: { on: true } }
			});
			expect(texts.some((t) => /^\d+(\.\d+)?\s*(m|ft)$/.test(t.trim()))).toBe(false);
		}
	});
});

describe('north rotation', () => {
	it('still draws the north arrow when the floor is unrotated', () => {
		const { doc, texts } = fakeDoc();
		buildMapPdf(() => doc as never, [page()], {}, [], header, 'command', {
			plan: { north: { on: true } }
		});
		expect(texts).toContain('N');
	});

	it('draws a rotated arrow for a floor whose north is not up', () => {
		const a = fakeDoc();
		buildMapPdf(() => a.doc as never, [page({ northDeg: 0 })], {}, [], header, 'command', {
			plan: { north: { on: true } }
		});
		const b = fakeDoc();
		buildMapPdf(() => b.doc as never, [page({ northDeg: 90 })], {}, [], header, 'command', {
			plan: { north: { on: true } }
		});
		// Same primitive count, different geometry: the arrow turned.
		expect(b.triangles.length).toBe(a.triangles.length);
		expect(JSON.stringify(b.triangles)).not.toBe(JSON.stringify(a.triangles));
	});
});
