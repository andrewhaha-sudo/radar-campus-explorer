// Which pages of a source PDF belong in a map export (Epic E6).
//
// Extracted from export-client so the rule is testable in Node - the
// surrounding PDF.js render needs a browser canvas.

import type { MapMarker } from './markers';

/** Ascending, deduplicated list of pages carrying markers; [1] when there are none. */
export function pagesToExport(markers: MapMarker[], pageCount: number): number[] {
	const pages = new Set<number>();
	for (const m of markers) {
		if (Number.isInteger(m.page) && m.page >= 1 && m.page <= pageCount) pages.add(m.page);
	}
	if (pages.size === 0) return [1];
	return [...pages].sort((a, b) => a - b);
}
