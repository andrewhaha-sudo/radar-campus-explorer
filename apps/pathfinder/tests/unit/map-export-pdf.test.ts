// Integration smoke test for the NFPA PDF exporter (Epic E6). Drives buildMapPdf
// with a recording fake jsPDF so we can assert it wires the (separately unit-
// tested) layout/legend math into the right number of pages, sizes, images and
// marker draws - without a real canvas or PDF backend.

import { describe, it, expect, vi } from 'vitest';
import { buildMapPdf, exportFilename } from '../../src/lib/engines/map-export/export-pdf';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';

function fakeDoc() {
	const calls = { addPage: 0, addImage: 0, circle: 0, pins: 0, text: [] as string[], pageSizes: [] as unknown[] };
	const doc: Record<string, (...a: unknown[]) => unknown> = {};
	for (const m of ['setFillColor', 'rect', 'setTextColor', 'setFont', 'setFontSize', 'setDrawColor', 'setLineWidth', 'line']) {
		doc[m] = vi.fn();
	}
	doc.addImage = vi.fn(() => calls.addImage++);
	doc.circle = vi.fn(() => calls.circle++);
	// style-specific pin shapes (command=roundedRect, field=diamond via triangle)
	doc.roundedRect = vi.fn(() => calls.pins++);
	doc.triangle = vi.fn(() => calls.pins++);
	doc.text = vi.fn((t: unknown) => {
		calls.text.push(String(t));
	});
	doc.addPage = vi.fn((size: unknown) => {
		calls.addPage++;
		calls.pageSizes.push(size);
	});
	return { doc, calls };
}

const mk = (over: Partial<MapMarker>): MapMarker => ({
	id: Math.random().toString(36).slice(2),
	type: 'stairs',
	label: 'S1',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

describe('buildMapPdf', () => {
	const img = 'data:image/jpeg;base64,AAAA';

	it('renders a single page with header, floorplan image and one marker pin', () => {
		const { doc, calls } = fakeDoc();
		let made = 0;
		buildMapPdf(
			() => {
				made++;
				return doc as never;
			},
			[{ page: 1, imageDataUrl: img, canvasW: 1000, canvasH: 800, markers: [mk({})] }],
			{},
			[mk({})],
			{ facilityName: 'WAHS Main' }
		);
		expect(made).toBe(1); // first page via factory, not addPage
		expect(calls.addPage).toBe(0);
		expect(calls.addImage).toBe(1);
		// command style: marker pin = rounded rect (shadow + fill) -> 2 pin draws
		expect(calls.pins).toBeGreaterThanOrEqual(2);
		// legend chips carry the type's own icon art now (defect M4), so a stairs
		// chip is a shaped container plus staircase strokes, never a plain circle
		expect(calls.circle).toBe(0);
		expect(calls.text.join(' ')).toContain('WAHS Main');
		expect(calls.text.join(' ')).toContain('LEGEND');
	});

	it('field style draws diamond pins (triangles), not rounded rects', () => {
		const { doc, calls } = fakeDoc();
		const rr = doc.roundedRect as ReturnType<typeof vi.fn>;
		buildMapPdf(
			() => doc as never,
			[{ page: 1, imageDataUrl: img, canvasW: 1000, canvasH: 800, markers: [mk({})] }],
			{},
			[mk({})],
			{ facilityName: 'X' },
			'field'
		);
		expect(calls.pins).toBeGreaterThanOrEqual(2); // 2 triangles per diamond, x2 passes
		expect(rr).not.toHaveBeenCalled(); // field uses diamonds, not rects
	});

	it('adds a page per extra floor and orders by printOrder', () => {
		const { doc, calls } = fakeDoc();
		buildMapPdf(
			() => doc as never,
			[
				{ page: 1, imageDataUrl: img, canvasW: 1000, canvasH: 800, markers: [] },
				{ page: 2, imageDataUrl: img, canvasW: 1000, canvasH: 800, markers: [] }
			],
			{ 1: { nx: 0, ny: 0, nw: 1, nh: 1, printOrder: 2 }, 2: { nx: 0, ny: 0, nw: 1, nh: 1, printOrder: 1 } },
			[],
			{ facilityName: 'X' }
		);
		expect(calls.addPage).toBe(1); // 2 pages total, first from factory
	});

	it('exportFilename slugifies the facility name', () => {
		expect(exportFilename('WAHS Main - Floor 1.pdf')).toBe('WAHS_Main___Floor_1_pdf_map.pdf');
	});
});
