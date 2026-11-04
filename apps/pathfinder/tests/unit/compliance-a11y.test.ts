// Unit tests for NG911/NENA export (E11) and the non-visual map alternative
// (E12). Lock the procurement-critical correctness: z-axis floor labels per
// NENA-REQ-003, a confidence field, and an equivalent text map for SR users.

import { describe, it, expect } from 'vitest';
import {
	buildNenaFeatureCollection,
	floorLabel,
	locationConfidence
} from '../../src/lib/engines/compliance/ng911';
import { buildMapTextAlternative, mapTextToString } from '../../src/lib/engines/a11y/map-text';

describe('NG911 / NENA export', () => {
	it('labels floors per NENA-REQ-003', () => {
		expect(floorLabel(1)).toBe('Floor 1');
		expect(floorLabel(0)).toBe('Ground floor');
		expect(floorLabel(-1)).toBe('Basement 1');
		expect(floorLabel(null)).toBe('Unspecified floor');
	});

	it('confidence reflects available location data', () => {
		expect(locationConfidence(true, true)).toBeGreaterThan(0.9);
		expect(locationConfidence(false, true)).toBeCloseTo(0.4);
		expect(locationConfidence(false, false)).toBeCloseTo(0.1);
	});

	it('emits one feature per building floor with a floor label + confidence', () => {
		const fc = buildNenaFeatureCollection(
			{ id: 'f1', name: 'WAHS', address: '225 Nichols St', zip: '16901', phone: null, type: 'school' },
			[{ id: 'b1', name: 'Main', floors: 3 }],
			[{ type: 'aed', label: 'AED-1', floor: 2 }],
			'2026-06-16T00:00:00Z'
		);
		expect(fc.type).toBe('FeatureCollection');
		expect(fc.metadata.standard).toMatch(/NENA-STA-006/);
		const floors = fc.features.filter((f) => f.properties.featureClass === 'StructureFloor');
		expect(floors).toHaveLength(3);
		expect(floors[0].properties.floorLabel).toBe('Floor 1');
		expect(floors.every((f) => typeof f.properties.confidence === 'number')).toBe(true);
		const marker = fc.features.find((f) => f.properties.featureClass === 'SafetyMarker');
		expect(marker?.properties.floorLabel).toBe('Floor 2');
	});

	it('uses Point geometry only when a coordinate is present', () => {
		const fc = buildNenaFeatureCollection(
			{ id: 'f', name: 'x', address: null, zip: null, phone: null, type: null },
			[],
			[
				{ type: 'exit', label: 'E1', lon: -77.3, lat: 41.7 },
				{ type: 'exit', label: 'E2' }
			],
			'now'
		);
		const [located, unlocated] = fc.features;
		expect(located.geometry).toEqual({ type: 'Point', coordinates: [-77.3, 41.7] });
		expect(unlocated.geometry).toBeNull();
	});
});

describe('non-visual map alternative', () => {
	const annotations = [
		{ type: 'aed', page: 1 },
		{ type: 'exit', page: 1 },
		{ type: 'exit', page: 1 },
		{ type: 'comment', page: 1, text: 'Door sticks in winter' },
		{ type: 'aed', page: 2 }
	];
	const markers = [
		{ type: 'stairs', label: 'S2', page: 1 },
		{ type: 'stairs', label: 'S1', page: 1 }
	];

	it('summarises safety features per floor with counts', () => {
		const sections = buildMapTextAlternative(1, annotations, markers);
		const headings = sections.map((s) => s.heading);
		expect(headings).toContain('AED (defibrillator)');
		expect(headings).toContain('Exit');
		expect(headings).toContain('Stairwell');
		expect(headings).toContain('Notes');
		const exit = sections.find((s) => s.heading === 'Exit')!;
		expect(exit.items[0]).toMatch(/2 Exit/);
		// stairwell labels are sorted
		const stairs = sections.find((s) => s.heading === 'Stairwell')!;
		expect(stairs.items).toEqual(['Stairwell S1', 'Stairwell S2']);
	});

	it('flattens to a screen-reader string', () => {
		const s = mapTextToString(buildMapTextAlternative(2, annotations, []));
		expect(s).toContain('AED');
	});

	it('handles an empty floor', () => {
		const sections = buildMapTextAlternative(9, annotations, markers);
		expect(sections[0].items[0]).toMatch(/No safety features/);
	});
});
