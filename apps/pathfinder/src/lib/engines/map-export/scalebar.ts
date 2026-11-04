// Map engine - printed scale bar geometry (design doc 2026-08-18, plan.scaleBar).
//
// The theme has carried a plan.scaleBar token since the theming pass, but it
// was inert: nothing in the data said how big the building actually is, so
// there was no honest length to draw. `floors.plan_scale` (migration 0016)
// supplies it - real-world millimetres spanned by one normalized unit of plan
// width - and this module turns that into a bar.
//
// Two rules, both about trust rather than looks:
//
//   1. A scale bar is a measuring instrument. A responder may hold a finger or
//      a ruler against it and act on the answer, so the printed length is
//      always a round real-world number (1, 2, 5, 10, 25, 50, 100 times a power
//      of ten) and is rounded DOWN, never stretched to fill the space.
//   2. A floor with no plan scale prints NO bar. niceScaleLength returns null
//      rather than guessing, because a plausible-looking wrong scale on a
//      life-safety document is worse than no scale at all.
//
// Pure and DOM-free: the jsPDF drawing lives in the exporter, the same split
// the rest of this engine uses.

export type ScaleUnits = 'metric' | 'imperial';

/** The nice ladder, per decade. Declared here so tests and UI copy agree. */
export const NICE_MANTISSAS = [1, 2, 5, 10, 25, 50, 100] as const;

/** Millimetres in one base unit: a metre, or a foot. */
const BASE_MM: Record<ScaleUnits, number> = { metric: 1000, imperial: 304.8 };

const MM_PER_INCH = 25.4;

/** How the plan sits on the printed page. */
export interface PageScale {
	/** Printed width in mm of one normalized unit of plan width. */
	widthMm: number;
	/** Fraction of the plan's width actually printed, for a crop. Default 1. */
	cropFraction?: number;
}

/** A chosen bar: what it measures, how long to draw it, what to print under it. */
export interface ScaleBarChoice {
	/** Real-world distance the bar spans, in millimetres. */
	realWorldMm: number;
	/** Length of the bar on the page, in millimetres. */
	barMm: number;
	/** Human caption, e.g. "10 m" or "25 ft". */
	label: string;
}

/** One block of the classic checkered bar. */
export interface ScaleBarSegment {
	startMm: number;
	endMm: number;
	filled: boolean;
}

function usable(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Real-world millimetres represented by one printed millimetre.
 *
 * `planScale` is the stored `floors.plan_scale`: real-world mm per normalized
 * unit of plan width. Printing that unit `widthMm` millimetres wide spreads it
 * over the page; a crop narrows what is shown without narrowing the print, so
 * each printed millimetre then covers proportionally less of the world.
 *
 * Returns null - never a fallback number - when any input is missing or absurd.
 * Omitting `page` treats `planScale` as already page-relative, which is what
 * the two-argument form of niceScaleLength does.
 */
export function realMmPerPageMm(
	planScale: number | null | undefined,
	page?: PageScale
): number | null {
	if (!usable(planScale)) return null;
	if (!page) return planScale;
	const crop = page.cropFraction ?? 1;
	if (!usable(page.widthMm) || !usable(crop)) return null;
	return (planScale * crop) / page.widthMm;
}

/** Every nice length, ascending, in base units. Spans building to campus. */
function ladder(): number[] {
	const out: number[] = [];
	for (let e = -6; e <= 9; e++) {
		for (const m of NICE_MANTISSAS) {
			out.push(Number((m * Math.pow(10, e)).toPrecision(12)));
		}
	}
	return [...new Set(out)].sort((a, b) => a - b);
}

const LADDER = ladder();

/** Trim float noise, then print without trailing zeros. */
function num(v: number): string {
	return String(Number(v.toPrecision(12)));
}

/** Caption for a length expressed in base units of the chosen system. */
function caption(value: number, units: ScaleUnits): string {
	if (units === 'imperial') {
		const inches = value * (BASE_MM.imperial / MM_PER_INCH);
		// Below a foot, whole inches read far better than "0.5 ft".
		if (value < 1 && Math.abs(inches - Math.round(inches)) < 1e-9) {
			return `${num(Math.round(inches))} in`;
		}
		return `${num(value)} ft`;
	}
	if (value < 1) return `${num(value * 1000)} mm`;
	return `${num(value)} m`;
}

/**
 * Choose the bar for a space roughly `targetMm` wide on the page.
 *
 * Returns the largest nice real-world length that still fits inside targetMm,
 * so the bar never overruns the box the layout gave it. Returns null when the
 * scale is unknown, non-positive or non-finite, or when there is no space to
 * draw in - the caller must then print no scale bar at all.
 */
export function niceScaleLength(
	targetMm: number,
	planScale: number | null | undefined,
	units: ScaleUnits = 'metric',
	page?: PageScale
): ScaleBarChoice | null {
	if (!usable(targetMm)) return null;
	const mmPerMm = realMmPerPageMm(planScale, page);
	if (mmPerMm === null || !usable(mmPerMm)) return null;

	const base = BASE_MM[units] ?? BASE_MM.metric;
	// The most the bar could measure if it filled the space exactly.
	const limit = (targetMm * mmPerMm) / base;

	let value: number | null = null;
	for (const candidate of LADDER) {
		if (candidate <= limit * (1 + 1e-12)) value = candidate;
		else break;
	}
	// Below the finest rung the plan is too coarse for a bar of this size to
	// mean anything; refusing is the honest answer.
	if (value === null) return null;

	const realWorldMm = value * base;
	return { realWorldMm, barMm: realWorldMm / mmPerMm, label: caption(value, units) };
}

/**
 * Split a bar into `n` equal alternating blocks, filled first, so it reads as
 * the classic checkered measure rather than a plain rule. The last block ends
 * exactly on barMm - accumulating a segment width would drift.
 *
 * Returns an empty list for a bar with no length or a nonsensical count; there
 * is nothing meaningful to draw and a partial bar would misread.
 */
export function scaleBarSegments(barMm: number, n: number): ScaleBarSegment[] {
	if (!usable(barMm)) return [];
	if (!Number.isInteger(n) || n < 1) return [];
	const segments: ScaleBarSegment[] = [];
	for (let i = 0; i < n; i++) {
		segments.push({
			startMm: (barMm * i) / n,
			endMm: (barMm * (i + 1)) / n,
			filled: i % 2 === 0
		});
	}
	return segments;
}
