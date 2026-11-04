// Map engine - marker types, auto-numbering, colours, polygon math (Epic E6).
//
// The persistent wayfinding layer, separate from review annotations. Ported
// verbatim from v1 viewer.js: MAP_TYPES, reNumberMarkers, _hallwayColor,
// _labelSort, _snap90, _pointInPoly, centroid. Pure - no DOM.

export type MapMarkerType = 'stairs' | 'hallway' | 'door' | 'elevator' | 'room';

export interface MapTypeMeta {
	prefix: string;
	color: string;
	label: string;
}

/** v1 MAP_TYPES. `room` exists in the engine; the D1 CHECK allows it too
 *  (migration 0004) so engine and schema agree. */
export const MAP_TYPES: Record<MapMarkerType, MapTypeMeta> = {
	stairs: { prefix: 'S', color: '#DC2626', label: 'Stairwell' },
	hallway: { prefix: 'H', color: '#16A34A', label: 'Hallway' },
	door: { prefix: 'D', color: '#2563EB', label: 'Door' },
	elevator: { prefix: 'E', color: '#7C3AED', label: 'Elevator' },
	room: { prefix: 'R', color: '#475569', label: 'Room' }
};

/** v1 HALLWAY_COLORS - 8-colour cycle keyed by label number. */
export const HALLWAY_COLORS = [
	'#16A34A',
	'#0EA5E9',
	'#F59E0B',
	'#EC4899',
	'#8B5CF6',
	'#14B8A6',
	'#EF4444',
	'#84CC16'
];

export interface MapMarker {
	id: string;
	type: MapMarkerType;
	label: string;
	page: number;
	nx: number;
	ny: number;
	labelPinned?: boolean; // user typed a label -> keep it, skip auto-number
	labelFrozen?: boolean; // committed by an export -> keep it (Epic E15, freeze on export)
	labelNx?: number | null;
	labelNy?: number | null;
	points?: Array<{ nx: number; ny: number }>; // hallway polygon (>=3)
	extraLabels?: Array<{ nx: number; ny: number }>;
	createdAt?: string;
	docId?: string; // owning document; set when markers span several PDFs
	floorId?: string; // owning floor in the building stack (Epic E15)
	shaftId?: string; // one physical stairwell/elevator spanning floors (Epic E15)
}

/** Hallway colour for a label (v1 _hallwayColor): parse digits, cycle by 8. */
export function hallwayColor(label: string): string {
	const num = parseInt(label.replace(/\D/g, ''), 10);
	if (isNaN(num) || num < 1) return HALLWAY_COLORS[0];
	return HALLWAY_COLORS[(num - 1) % HALLWAY_COLORS.length];
}

/** Numeric-aware label sort (v1 _labelSort). */
export function labelSort(a: string, b: string): number {
	const an = parseInt(a.replace(/\D/g, ''), 10);
	const bn = parseInt(b.replace(/\D/g, ''), 10);
	if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
	return a.localeCompare(b);
}

/** Spreadsheet-style door label: 1 -> A, 26 -> Z, 27 -> AA. v1 used
 *  String.fromCharCode(65 + n), so its 27th door was "[". */
export function doorLabel(n: number): string {
	let out = '';
	let i = n;
	while (i > 0) {
		const r = (i - 1) % 26;
		out = String.fromCharCode(65 + r) + out;
		i = Math.floor((i - 1) / 26);
	}
	return out;
}

export interface RenumberOptions {
	/** Position of a marker's floor in the building stack; lower is lower down.
	 *  Defaults to the page number, correct when one PDF is one building. */
	floorIndex?: (m: MapMarker) => number;
	/** Doors get letters (A, B, C) by default; false numbers them D1, D2. */
	doorsUseLetters?: boolean;
	/** First number in the sequence. Default 1. */
	startAt?: number;
}

/**
 * Re-number markers in place, floor-major (Epic E15).
 *
 * Ordering is (floor, createdAt), so labels ascend as you walk up the building
 * and adding a marker to a lower floor inserts rather than appends. Numbering is
 * two-pass: pinned and frozen labels go into a taken-set first, then auto labels
 * take the next number NOT in that set - so a duplicate is unreachable by
 * construction. Markers sharing a shaftId (one physical stairwell or elevator
 * spanning floors) are numbered once, from their lowest floor, and consume a
 * single number between them.
 *
 * Mutates and returns the array.
 */
export function reNumberMarkers(markers: MapMarker[], options: RenumberOptions = {}): MapMarker[] {
	const floorIndex = options.floorIndex ?? ((m: MapMarker) => m.page ?? 1);
	const useLetters = options.doorsUseLetters ?? true;
	const startAt = options.startAt ?? 1;

	const labelFor = (type: MapMarkerType, n: number): string =>
		type === 'door' && useLetters ? doorLabel(n) : MAP_TYPES[type].prefix + n;

	const byType = new Map<MapMarkerType, MapMarker[]>();
	for (const m of markers) {
		const arr = byType.get(m.type) ?? [];
		arr.push(m);
		byType.set(m.type, arr);
	}

	for (const [type, list] of byType) {
		// A unit is one marker, or every marker sharing a shaft. Sorting a unit by
		// its LOWEST floor is what makes a shaft take its basement number.
		const units = new Map<string, MapMarker[]>();
		for (const m of list) {
			const key = m.shaftId ? `shaft:${m.shaftId}` : `marker:${m.id}`;
			const arr = units.get(key) ?? [];
			arr.push(m);
			units.set(key, arr);
		}

		const sortKey = (group: MapMarker[]) =>
			group.reduce(
				(best, m) => {
					const f = floorIndex(m) ?? 0;
					const c = m.createdAt ?? '';
					if (f < best.f || (f === best.f && c < best.c)) return { f, c };
					return best;
				},
				{ f: Infinity, c: '\uFFFF' }
			);

		const ordered = [...units.values()].sort((a, b) => {
			const ka = sortKey(a);
			const kb = sortKey(b);
			return ka.f - kb.f || ka.c.localeCompare(kb.c);
		});

		// Pass 1: every label the user has fixed in place is off-limits.
		const taken = new Set<string>();
		for (const m of list) {
			if (m.labelPinned || m.labelFrozen) taken.add(m.label);
		}

		// Pass 2: hand out the next label not already claimed.
		let n = startAt;
		for (const group of ordered) {
			if (group.some((m) => m.labelPinned || m.labelFrozen)) continue;
			while (taken.has(labelFor(type, n))) n++;
			const label = labelFor(type, n);
			taken.add(label);
			for (const m of group) m.label = label;
			n++;
		}
	}
	return markers;
}

/** Snap a delta to the nearest 45 degrees when shift is held (v1 _snap90). */
export function snap90(dx: number, dy: number): { dx: number; dy: number } {
	const ang = Math.atan2(dy, dx);
	const step = Math.PI / 4;
	const snapped = Math.round(ang / step) * step;
	const len = Math.hypot(dx, dy);
	return { dx: Math.cos(snapped) * len, dy: Math.sin(snapped) * len };
}

/** Ray-cast point-in-polygon (v1 _pointInPoly). pts in normalized space. */
export function pointInPoly(nx: number, ny: number, pts: Array<{ nx: number; ny: number }>): boolean {
	let inside = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const xi = pts[i].nx;
		const yi = pts[i].ny;
		const xj = pts[j].nx;
		const yj = pts[j].ny;
		const intersect =
			yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

type Pt = { nx: number; ny: number };

/** Index of the polygon vertex within `tol` of (nx,ny), or -1 (for vertex drag/
 *  delete hit-testing). */
export function nearestVertex(pts: Pt[], nx: number, ny: number, tol = 0.02): number {
	let best = -1;
	let bestD = tol;
	pts.forEach((p, i) => {
		const d = Math.hypot(p.nx - nx, p.ny - ny);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	});
	return best;
}

/** The segment index whose midpoint is nearest (nx,ny) within `tol`, or -1
 *  (for midpoint-insert hit-testing). Segment i joins vertex i and i+1 (wrap). */
export function nearestMidpoint(pts: Pt[], nx: number, ny: number, tol = 0.02): number {
	let best = -1;
	let bestD = tol;
	for (let i = 0; i < pts.length; i++) {
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		const mx = (a.nx + b.nx) / 2;
		const my = (a.ny + b.ny) / 2;
		const d = Math.hypot(mx - nx, my - ny);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
}

/** Insert a vertex at the midpoint of segment `segIndex`. Returns a new array. */
export function insertMidpoint(pts: Pt[], segIndex: number): Pt[] {
	const a = pts[segIndex];
	const b = pts[(segIndex + 1) % pts.length];
	const mid = { nx: (a.nx + b.nx) / 2, ny: (a.ny + b.ny) / 2 };
	const next = pts.slice();
	next.splice(segIndex + 1, 0, mid);
	return next;
}

/** Delete vertex `i`, keeping a minimum of 3 (returns the original if at 3). */
export function deleteVertex(pts: Pt[], i: number): Pt[] {
	if (pts.length <= 3) return pts;
	return pts.filter((_, idx) => idx !== i);
}

/** Centroid (mean of vertices) of a polygon (v1 hallway centroid). */
export function centroid(pts: Array<{ nx: number; ny: number }>): { nx: number; ny: number } {
	if (pts.length === 0) return { nx: 0, ny: 0 };
	let sx = 0;
	let sy = 0;
	for (const p of pts) {
		sx += p.nx;
		sy += p.ny;
	}
	return { nx: sx / pts.length, ny: sy / pts.length };
}
