// 2D annotation engine - hit testing (Epic E5).
//
// Pure given an annotation list + canvas dims + a canvas-space point. Ported
// from v1 hitTest. Markers/comments hit-test against the pin BODY (a circle
// PIN_TIP_OFFSET above the stored tip); bbox shapes test the bounding box
// (using min/max so negative nw/nh still work); freehand tests segment
// proximity. Topmost (last drawn) match wins, so we scan back-to-front.

import {
	MARKER_TOOLS,
	PIN_RADIUS,
	PIN_TIP_OFFSET,
	type Annotation,
	type CanvasDims
} from './types';

const isPin = (t: string) => t === 'comment' || MARKER_TOOLS.includes(t as Annotation['type']);

/** Distance from point P to segment AB, in the same units as the inputs. */
function distToSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	if (len2 === 0) return Math.hypot(px - ax, py - ay);
	let t = ((px - ax) * dx + (py - ay) * dy) / len2;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Return the id of the topmost annotation under canvas-space point (x,y), or
 * null. `tol` is the proximity tolerance (canvas px) for thin shapes.
 */
export function hitTest(
	annotations: Annotation[],
	x: number,
	y: number,
	dims: CanvasDims,
	tol = 6
): string | null {
	for (let i = annotations.length - 1; i >= 0; i--) {
		const a = annotations[i];
		if (a.page === undefined) continue;
		if (isPin(a.type)) {
			const cx = a.nx * dims.width;
			const cy = a.ny * dims.height - PIN_TIP_OFFSET; // body centre above tip
			if (Math.hypot(x - cx, y - cy) <= PIN_RADIUS + tol) return a.id;
			continue;
		}
		if (a.type === 'freehand' && a.points && a.points.length > 1) {
			for (let p = 1; p < a.points.length; p++) {
				const [ax, ay] = a.points[p - 1];
				const [bx, by] = a.points[p];
				if (
					distToSegment(
						x,
						y,
						ax * dims.width,
						ay * dims.height,
						bx * dims.width,
						by * dims.height
					) <= tol
				) {
					return a.id;
				}
			}
			continue;
		}
		// bbox shapes (circle/rect/arrow/correction): min/max handles negative w/h
		const x1 = Math.min(a.nx, a.nx + a.nw) * dims.width - tol;
		const x2 = Math.max(a.nx, a.nx + a.nw) * dims.width + tol;
		const y1 = Math.min(a.ny, a.ny + a.nh) * dims.height - tol;
		const y2 = Math.max(a.ny, a.ny + a.nh) * dims.height + tol;
		if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return a.id;
	}
	return null;
}
