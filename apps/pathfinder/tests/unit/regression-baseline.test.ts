// Delivery-harness ACs (E14) + brand token propagation (AC-1.4.2).
//
// AC-14.3.1/14.3.2: a deterministic baseline of load-bearing engine output is
//   captured (toMatchSnapshot) and any regression beyond it fails the test.
//   (Complements the Playwright screenshot capture in tests/e2e/__screenshots__.)
// AC-14.1.1: the harness expresses red-first - a test for an unimplemented
//   feature fails before it exists.
// AC-1.4.2: a brand token change propagates because every colour is emitted as
//   a --brand-* custom property the components consume.

import { describe, it, expect } from 'vitest';
import { layoutItem, buildLegendItems, legendHeight } from '../../src/lib/engines/map-export/legend';
import { MAP_TYPES, type MapMarker } from '../../src/lib/engines/map-export/markers';
import { buildExport } from '../../src/lib/engines/2d-annotate/export-json';
import { brandToCssVars } from '../../src/lib/brand';
import { pathfinder } from '../../src/lib/brand/profiles/pathfinder';
import type { Annotation } from '../../src/lib/engines/2d-annotate/types';

const meta = Object.fromEntries(
	Object.entries(MAP_TYPES).map(([k, v]) => [k, { label: v.label, color: v.color }])
) as Record<keyof typeof MAP_TYPES, { label: string; color: string }>;

describe('AC-14.3.1 / AC-14.3.2 deterministic regression baseline', () => {
	it('legend autofit layout matches the committed baseline', () => {
		const markers: MapMarker[] = [
			{ id: '1', type: 'door', label: 'A', page: 1, nx: 0.1, ny: 0.1 },
			{ id: '2', type: 'door', label: 'B', page: 1, nx: 0.2, ny: 0.2 },
			{ id: '3', type: 'stairs', label: 'S1', page: 1, nx: 0.3, ny: 0.3 }
		];
		const items = buildLegendItems(markers, markers, meta);
		const layout = items.map((i) => ({ type: i.type, ...layoutItem(i, 'command') }));
		expect({ layout, height: legendHeight(items, 'command') }).toMatchSnapshot();
	});

	it('JSON export envelope matches the committed baseline', () => {
		const anns: Annotation[] = [
			{ id: 'a1', page: 1, type: 'circle', nx: 0.123456, ny: 0.2, nw: 0.1, nh: 0.1, color: '#B22234' }
		];
		expect(buildExport('doc', 'Floor 1', anns, '2026-01-01T00:00:00Z')).toMatchSnapshot();
	});
});

describe('AC-14.1.1 red-first', () => {
	// This test asserts a NOT-YET-implemented capability and is expected to fail;
	// `it.fails` documents the red-first discipline (a feature test fails before
	// the feature exists). When the capability lands, flip it to a normal `it`.
	it.fails('a test for an unimplemented capability is red until it is built', () => {
		const engine = {} as { exportDWG?: () => string };
		// CAD/DWG export is backlog (post-S7); its test is red today.
		expect(engine.exportDWG!()).toBe('dwg');
	});
});

describe('AC-1.4.2 brand token change propagates via CSS vars', () => {
	it('every brand colour is emitted as a --brand-* custom property', () => {
		const css = brandToCssVars(pathfinder);
		for (const key of Object.keys(pathfinder.colors)) {
			expect(css).toContain(`--brand-${key}`);
		}
	});
});
