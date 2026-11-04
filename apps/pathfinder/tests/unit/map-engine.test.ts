// Characterization tests for the ported map/NFPA export engine (Epic E6).
// Lock the fiddly v1 correctness the de-risking principle says not to
// re-litigate: numbering, hallway colours, legend autofit math, page sizing.

import { describe, it, expect } from 'vitest';
import {
	MAP_TYPES,
	HALLWAY_COLORS,
	hallwayColor,
	labelSort,
	reNumberMarkers,
	snap90,
	pointInPoly,
	centroid,
	type MapMarker
} from '../../src/lib/engines/map-export/markers';
import {
	legCellSize,
	layoutItem,
	legendHeight,
	buildLegendItems,
	placeChips,
	LEG_ICON_W,
	type LegendItem,
	type PrintStyle
} from '../../src/lib/engines/map-export/legend';
import { orderPages, cropPx, pageSizeMm, markerMm, hexToRgb, alignExtraLabels, PX2MM } from '../../src/lib/engines/map-export/layout';

const mk = (over: Partial<MapMarker>): MapMarker => ({
	id: Math.random().toString(36).slice(2),
	type: 'stairs',
	label: '',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

describe('marker numbering', () => {
	it('numbers non-door types prefix+(n+1) in createdAt order', () => {
		const markers = [
			mk({ type: 'stairs', createdAt: '2026-01-02' }),
			mk({ type: 'stairs', createdAt: '2026-01-01' })
		];
		reNumberMarkers(markers);
		// earliest createdAt becomes S1
		const earliest = markers.find((m) => m.createdAt === '2026-01-01')!;
		const latest = markers.find((m) => m.createdAt === '2026-01-02')!;
		expect(earliest.label).toBe('S1');
		expect(latest.label).toBe('S2');
	});

	it('numbers doors with letters A, B, C', () => {
		const markers = [
			mk({ type: 'door', createdAt: '2026-01-01' }),
			mk({ type: 'door', createdAt: '2026-01-02' }),
			mk({ type: 'door', createdAt: '2026-01-03' })
		];
		reNumberMarkers(markers);
		expect(markers.map((m) => m.label)).toEqual(['A', 'B', 'C']);
	});

	it('pinned-label markers keep their label and do NOT consume a counter slot', () => {
		const markers = [
			mk({ type: 'stairs', createdAt: '2026-01-01', labelPinned: true, label: 'Main Stair' }),
			mk({ type: 'stairs', createdAt: '2026-01-02' })
		];
		reNumberMarkers(markers);
		expect(markers[0].label).toBe('Main Stair');
		expect(markers[1].label).toBe('S1'); // counter not consumed by the pinned one
	});
});

describe('hallway colours + label sort', () => {
	it('cycles 8 colours by label number', () => {
		expect(hallwayColor('H1')).toBe(HALLWAY_COLORS[0]);
		expect(hallwayColor('H8')).toBe(HALLWAY_COLORS[7]);
		expect(hallwayColor('H9')).toBe(HALLWAY_COLORS[0]); // wraps
	});
	it('labelSort is numeric-aware', () => {
		expect(['S10', 'S2', 'S1'].slice().sort(labelSort)).toEqual(['S1', 'S2', 'S10']);
	});
});

describe('polygon math', () => {
	it('snap90 snaps a delta to 45-degree increments preserving length', () => {
		const s = snap90(10, 1); // nearly horizontal -> snaps to 0deg
		expect(s.dx).toBeCloseTo(Math.hypot(10, 1));
		expect(s.dy).toBeCloseTo(0);
	});
	it('pointInPoly ray-casts correctly', () => {
		const square = [ { nx: 0, ny: 0 }, { nx: 1, ny: 0 }, { nx: 1, ny: 1 }, { nx: 0, ny: 1 } ];
		expect(pointInPoly(0.5, 0.5, square)).toBe(true);
		expect(pointInPoly(1.5, 0.5, square)).toBe(false);
	});
	it('centroid is the mean of vertices', () => {
		expect(centroid([ { nx: 0, ny: 0 }, { nx: 1, ny: 0 }, { nx: 0.5, ny: 1 } ])).toEqual({ nx: 0.5, ny: 1 / 3 });
	});
});

describe('legend autofit (verbatim v1 math)', () => {
	const meta = Object.fromEntries(
		Object.entries(MAP_TYPES).map(([k, v]) => [k, { label: v.label, color: v.color }])
	) as Record<keyof typeof MAP_TYPES, { label: string; color: string }>;

	it('legCellSize varies by style and type', () => {
		expect(legCellSize('hallway', 'command')).toEqual({ w: 11.0, h: 6.5, hgap: 1.2 });
		expect(legCellSize('door', 'blueprint')).toEqual({ w: 11.0, h: 15.0, hgap: 1.8 });
		expect(legCellSize('stairs', 'field')).toEqual({ w: 16.0, h: 10.0, hgap: 2.0 });
		expect(legCellSize('door', 'command')).toEqual({ w: 7.0, h: 10.0, hgap: 1.4 });
	});

	it('layoutItem wraps chips to fit the icon column width', () => {
		const item: LegendItem = {
			type: 'door',
			typeName: 'Doors',
			count: 20,
			buildingCount: 20,
			chips: Array.from({ length: 20 }, (_, i) => ({ label: String.fromCharCode(65 + i), color: '#000' }))
		};
		const style: PrintStyle = 'command';
		const lay = layoutItem(item, style);
		const cell = legCellSize('door', style);
		const expectedPerRow = Math.max(1, Math.floor((LEG_ICON_W + cell.hgap) / (cell.w + cell.hgap)));
		expect(lay.perRow).toBe(Math.min(20, expectedPerRow));
		expect(lay.rows).toBe(Math.ceil(20 / lay.perRow));
		expect(lay.rowH).toBeGreaterThanOrEqual(16); // LEG_ROW_MIN_H
	});

	it('legendHeight is 18 for an empty legend', () => {
		expect(legendHeight([], 'command')).toBe(18);
	});

	it('buildLegendItems makes one entry per present type with unique sorted chips', () => {
		const pageMarkers: MapMarker[] = [
			mk({ type: 'stairs', label: 'S1' }),
			mk({ type: 'stairs', label: 'S2' }),
			mk({ type: 'door', label: 'A' })
		];
		const items = buildLegendItems(pageMarkers, pageMarkers, meta);
		expect(items.map((i) => i.type)).toEqual(['stairs', 'door']); // canonical order
		expect(items[0].chips.map((c) => c.label)).toEqual(['S1', 'S2']);
		expect(items[0].count).toBe(2);
	});

	it('placeChips centres each wrapped row independently', () => {
		const item: LegendItem = {
			type: 'door', typeName: 'Doors', count: 3, buildingCount: 3,
			chips: [ { label: 'A', color: '#000' }, { label: 'B', color: '#000' }, { label: 'C', color: '#000' } ]
		};
		const lay = layoutItem(item, 'command');
		const placed = placeChips(item, lay, 18, 100);
		expect(placed).toHaveLength(3);
		// all chips on one row share a y centre
		expect(placed[0].y).toBeCloseTo(placed[1].y);
	});
});

describe('export layout math', () => {
	it('orderPages honours printOrder then document order', () => {
		const crops = { 1: { nx: 0, ny: 0, nw: 1, nh: 1, printOrder: 3 }, 2: { nx: 0, ny: 0, nw: 1, nh: 1, printOrder: 1 } };
		// page2 -> 1; page1 -> 3 (explicit) ties page3 -> 3 (fallback to page no.);
		// stable sort keeps the lower page index first on a tie.
		expect(orderPages([1, 2, 3], crops)).toEqual([2, 1, 3]);
	});

	it('cropPx returns full page when no crop', () => {
		expect(cropPx(undefined, 1000, 800)).toEqual({ x: 0, y: 0, w: 1000, h: 800 });
		expect(cropPx({ nx: 0.1, ny: 0.1, nw: 0.5, nh: 0.5 }, 1000, 800)).toEqual({ x: 100, y: 80, w: 500, h: 400 });
	});

	it('pageSizeMm = header + crop + legend + footer', () => {
		const sz = pageSizeMm(1000, 800, 50);
		expect(sz.cropWmm).toBeCloseTo(1000 * PX2MM);
		expect(sz.hMm).toBeCloseTo(36 + 800 * PX2MM + 50 + 8);
	});

	it('markerMm offsets by header and crop origin', () => {
		const p = markerMm({ nx: 0.5, ny: 0.5 }, 1000, 800, 100, 80);
		expect(p.x).toBeCloseTo((0.5 * 1000 - 100) * PX2MM);
		expect(p.y).toBeCloseTo(36 + (0.5 * 800 - 80) * PX2MM);
	});

	it('hexToRgb parses #RRGGBB', () => {
		expect(hexToRgb('#16A34A')).toEqual([22, 163, 74]);
	});

	it('alignExtraLabels snaps pins within ALIGN_MM to the anchor axis', () => {
		const out = alignExtraLabels({ x: 100, y: 100 }, [ { x: 102, y: 130 }, { x: 140, y: 101 } ]);
		expect(out[0].x).toBe(100); // x within 4mm of anchor -> snapped
		expect(out[1].y).toBe(100); // y within 4mm of anchor -> snapped
	});
});
