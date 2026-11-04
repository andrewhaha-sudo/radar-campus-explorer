// Which pages of a source PDF belong in a map export (Epic E6, AC-6.4.1).
//
// Regression guard for the batch-export defect: renderFirstPage hardcoded
// getPage(1) and filtered markers to page 1, so a three-floor plan exported
// as a single floor while AC-6.4.1 claimed correct multi-page output.

import { describe, it, expect } from 'vitest';
import { pagesToExport } from '../../src/lib/engines/map-export/pages';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';

function mk(page: number): MapMarker {
	return { id: `m${page}`, page, type: 'stairs', label: 'S1', nx: 0.5, ny: 0.5 };
}

describe('pagesToExport', () => {
	it('returns page 1 when there are no markers', () => {
		expect(pagesToExport([], 5)).toEqual([1]);
	});

	it('returns every page that carries a marker, ascending', () => {
		expect(pagesToExport([mk(3), mk(1), mk(2)], 5)).toEqual([1, 2, 3]);
	});

	it('deduplicates pages with several markers', () => {
		expect(pagesToExport([mk(2), mk(2), mk(2)], 5)).toEqual([2]);
	});

	it('drops pages beyond the document page count', () => {
		expect(pagesToExport([mk(1), mk(9)], 3)).toEqual([1]);
	});

	it('drops non-positive page numbers', () => {
		expect(pagesToExport([mk(0), mk(-1), mk(2)], 3)).toEqual([2]);
	});

	it('covers a three-floor building - the Rock L. Butler case', () => {
		expect(pagesToExport([mk(1), mk(2), mk(3)], 3)).toEqual([1, 2, 3]);
	});
});
