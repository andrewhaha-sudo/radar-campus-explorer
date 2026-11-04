// 2D annotation engine - direct-manipulation edits (Epic E5). Pure geometry for
// moving/resizing an annotation, used by the viewer's select+drag. No DOM.

import type { Annotation } from './types';

/** Translate an annotation by a normalized delta. Markers/comments move their
 *  tip (nx,ny); bbox shapes move their origin; freehand translates every point.
 *  Returns a new annotation (does not mutate). */
export function translateAnnotation(a: Annotation, dnx: number, dny: number): Annotation {
	if (a.type === 'freehand' && a.points) {
		return { ...a, points: a.points.map(([x, y]) => [x + dnx, y + dny] as [number, number]) };
	}
	return { ...a, nx: a.nx + dnx, ny: a.ny + dny };
}

/** Clamp an annotation's primary anchor into [0,1] after a move so it can't be
 *  dragged off the page (bbox/markers); freehand is left as-is (its points may
 *  legitimately span). */
export function clampAnnotation(a: Annotation): Annotation {
	if (a.type === 'freehand') return a;
	return { ...a, nx: Math.min(1, Math.max(0, a.nx)), ny: Math.min(1, Math.max(0, a.ny)) };
}
