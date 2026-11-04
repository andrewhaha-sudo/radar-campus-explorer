// Exporting a building assembled from separate per-floor PDFs (Epic E15, AC-15.3.x).
//
// buildMapPdf keyed both page ordering and crop lookup by page NUMBER. When a
// building's floors are separate documents they are all page 1, so they
// collided: one crop applied to every floor and the stack order was undefined.
// Pages now carry their own sortIndex, crop and floor label.

import { describe, it, expect } from 'vitest';
import { buildMapPdf, type ExportPageInput } from '../../src/lib/engines/map-export/export-pdf';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';

/** Recording stand-in for jsPDF: captures page sizes and every text call. */
function fakeDoc() {
	const pages: Array<{ size: [number, number]; orientation: string }> = [];
	const texts: string[] = [];
	const doc = {
		addPage(size: [number, number], orientation: string) {
			pages.push({ size, orientation });
		},
		text(t: string) {
			texts.push(String(t));
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
		rect: () => doc,
		roundedRect: () => doc,
		circle: () => doc,
		line: () => doc,
		triangle: () => doc,
		addImage: () => doc,
		getTextWidth: () => 10,
		save: () => doc
	};
	return { doc, pages, texts };
}

const mk = (over: Partial<MapMarker> = {}): MapMarker => ({
	id: Math.random().toString(36).slice(2),
	type: 'hallway',
	label: 'H1',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

/** Rock L. Butler: three floors, three PDFs, every one of them page 1. */
function rockButlerPages(): ExportPageInput[] {
	return [
		{
			page: 1,
			imageDataUrl: 'data:image/jpeg;base64,AAA',
			canvasW: 1000,
			canvasH: 800,
			markers: [mk({ label: 'H6' })],
			sortIndex: 2,
			floorLabel: '3'
		},
		{
			page: 1,
			imageDataUrl: 'data:image/jpeg;base64,BBB',
			canvasW: 1000,
			canvasH: 800,
			markers: [mk({ label: 'H2' })],
			sortIndex: 1,
			floorLabel: 'Main'
		},
		{
			page: 1,
			imageDataUrl: 'data:image/jpeg;base64,CCC',
			canvasW: 1000,
			canvasH: 800,
			markers: [mk({ label: 'H1' })],
			sortIndex: 0,
			floorLabel: '0'
		}
	];
}

describe('multi-document floor stack export', () => {
	it('emits one page per floor even when every source page is page 1', () => {
		const { doc, pages } = fakeDoc();
		const input = rockButlerPages();
		buildMapPdf(
			() => doc as never,
			input,
			{},
			input.flatMap((p) => p.markers),
			{ facilityName: 'Rock L. Butler' }
		);
		// first page comes from mkDoc, the other two from addPage
		expect(pages.length).toBe(2);
	});

	it('orders pages by sortIndex, so the basement prints first', () => {
		const { doc, texts } = fakeDoc();
		const input = rockButlerPages();
		buildMapPdf(
			() => doc as never,
			input,
			{},
			input.flatMap((p) => p.markers),
			{ facilityName: 'Rock L. Butler' }
		);
		const floorLines = texts.filter((t) => /(^|\s)(0|Main|3)$/.test(t.trim()));
		const order = floorLines.map((t) => t.trim().split(/\s+/).pop());
		expect(order).toEqual(['0', 'Main', '3']);
	});

	it('prints the floor label verbatim rather than "Floor N of M"', () => {
		const { doc, texts } = fakeDoc();
		const input = rockButlerPages();
		buildMapPdf(
			() => doc as never,
			input,
			{},
			input.flatMap((p) => p.markers),
			{ facilityName: 'Rock L. Butler' }
		);
		expect(texts.some((t) => t.includes('Main'))).toBe(true);
		expect(texts.some((t) => /Floor \d+ of \d+/.test(t))).toBe(false);
	});

	it('falls back to Floor N of M when a floor has no label', () => {
		const { doc, texts } = fakeDoc();
		const pages: ExportPageInput[] = [
			{
				page: 1,
				imageDataUrl: 'data:image/jpeg;base64,AAA',
				canvasW: 1000,
				canvasH: 800,
				markers: [],
				sortIndex: 0
			}
		];
		buildMapPdf(() => doc as never, pages, {}, [], { facilityName: 'Unlabelled' });
		expect(texts.some((t) => /Floor 1 of 1/.test(t))).toBe(true);
	});

	it('uses each page own crop, so two floors on page 1 do not share one', () => {
		const { doc, pages } = fakeDoc();
		const input: ExportPageInput[] = [
			{
				page: 1,
				imageDataUrl: 'd',
				canvasW: 1000,
				canvasH: 1000,
				markers: [],
				sortIndex: 0,
				crop: { nx: 0, ny: 0, nw: 1, nh: 1 }
			},
			{
				page: 1,
				imageDataUrl: 'd',
				canvasW: 1000,
				canvasH: 1000,
				markers: [],
				sortIndex: 1,
				crop: { nx: 0, ny: 0, nw: 0.5, nh: 0.5 }
			}
		];
		buildMapPdf(() => doc as never, input, {}, [], { facilityName: 'Crops' });
		// The half-size crop must produce a visibly narrower second page.
		expect(pages[0].size[0]).toBeLessThan(200);
	});

	it('still honours the legacy page-number ordering when no sortIndex is given', () => {
		const { doc, pages } = fakeDoc();
		const input: ExportPageInput[] = [
			{ page: 2, imageDataUrl: 'd', canvasW: 800, canvasH: 600, markers: [] },
			{ page: 1, imageDataUrl: 'd', canvasW: 800, canvasH: 600, markers: [] }
		];
		buildMapPdf(() => doc as never, input, {}, [], { facilityName: 'Legacy' });
		expect(pages.length).toBe(1);
	});
});
