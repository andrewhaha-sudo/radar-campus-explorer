// Map engine - NFPA multi-page PDF export (Epic E6).
//
// Browser-side: turns per-page render inputs into a printed NFPA-style map PDF
// using jsPDF. All geometry (page sizing, marker placement, legend autofit,
// chip layout) comes from the pure, unit-tested engine modules (legend.ts,
// layout.ts, markers.ts); this file only issues jsPDF draw calls.
//
// ONE SKELETON, EVERYTHING ELSE IS DATA (design doc 2026-08-18, section 5).
// The three hardcoded palettes and their `if (style === ...)` branches are
// gone: every colour, font size, millimetre dimension and printed string comes
// from a `MapTheme` token (theme.ts). `style` is still accepted and maps to the
// matching seeded preset, so saved exports and existing callers are unaffected;
// `theme` layers a partial on top. The default theme reproduces v1's Command
// look exactly, so a default export is unchanged.

import type jsPDF from 'jspdf';
import { type MapMarker, type MapMarkerType } from './markers';
import { buildLegendItems, layoutItem, legendHeight, placeChips, HDR_MM, type PrintStyle } from './legend';
export type { PrintStyle };
import {
	asTheme,
	fillTokens,
	formatDate,
	hallwayColorFor,
	mergeThemes,
	themeForStyle,
	type Corner,
	type DeepPartial,
	type MapTheme,
	type MarkerShape
} from './theme';
export type { MapTheme } from './theme';
import {
	orderPages,
	cropPx,
	pageSizeMm,
	markerMm,
	hexToRgb,
	floorLine,
	alignExtraLabels,
	type Crop
} from './layout';
import { niceScaleLength, scaleBarSegments } from './scalebar';

export interface ExportPageInput {
	page: number;
	imageDataUrl: string; // full rendered page as JPEG/PNG data URL
	canvasW: number;
	canvasH: number;
	markers: MapMarker[];
	/** Position in the building's floor stack, lowest first (Epic E15). When any
	 *  page supplies it, it replaces page-number ordering. Required for a stack
	 *  built from separate PDFs, where every source page is page 1. */
	sortIndex?: number;
	/** This page's own crop. Takes precedence over the page-keyed `crops` map,
	 *  which cannot represent two floors that are both page 1. */
	crop?: Crop;
	/** Verbatim floor label ("0", "Main", "3"). Never derived from a number. */
	floorLabel?: string;
	/** Real-world millimetres across the printed plan width. Absent means the
	 *  scale is unknown and no scale bar may be drawn (Epic E15). */
	planScale?: number;
	/** Rotation of true north from up, degrees clockwise. */
	northDeg?: number;
}

export interface ExportHeader {
	facilityName: string;
	address?: string;
	zip?: string;
	phone?: string;
	brandName?: string;
}

type Rgb = [number, number, number];

/** Themed colour -> jsPDF rgb triple. */
function rgb(hex: string): Rgb {
	return hexToRgb(hex);
}

/** Draw a themed marker pin centred at (x,y) in mm. Shape is one token, not
 *  three code paths (5.4). */
function drawPin(d: jsPDF, x: number, y: number, color: Rgb, shape: MarkerShape, t: MapTheme, sizeMm: number) {
	const r = sizeMm / 2;
	const off = t.plan.pinShadowMm;
	const body = (cx: number, cy: number) => {
		if (shape === 'diamond') drawDiamond(d, cx, cy, r * 2, r * 2, 'F');
		else if (shape === 'rect') d.roundedRect(cx - r, cy - r, r * 2, r * 2, t.plan.pinRadiusMm, t.plan.pinRadiusMm, 'F');
		else if (shape === 'pill')
			d.roundedRect(cx - r * 1.6, cy - r, r * 3.2, r * 2, r, r, 'F');
		else d.circle(cx, cy, r, 'F'); // badge, circle
	};
	if (off > 0) {
		const sh = rgb(t.plan.pinShadow);
		d.setFillColor(sh[0], sh[1], sh[2]);
		body(x + off, y + off);
	}
	d.setFillColor(color[0], color[1], color[2]);
	body(x, y);
}

/** A diamond (rotated rectangle) centred at (x,y). Filled from two triangles,
 *  stroked as four edges, so no jsPDF path API is needed either way. */
function drawDiamond(d: jsPDF, x: number, y: number, w: number, h: number, style: 'F' | 'S') {
	const hw = w / 2;
	const hh = h / 2;
	if (style === 'F') {
		d.triangle(x, y - hh, x + hw, y, x, y + hh, 'F');
		d.triangle(x, y - hh, x - hw, y, x, y + hh, 'F');
		return;
	}
	d.line(x, y - hh, x + hw, y);
	d.line(x + hw, y, x, y + hh);
	d.line(x, y + hh, x - hw, y);
	d.line(x - hw, y, x, y - hh);
}

/**
 * Run `draw` under a PDF graphics state opacity, then restore it.
 *
 * jsPDF exposes transparency through GState, which a stand-in doc (and older
 * builds) may not have; v1 guarded the same way. Without it the art still
 * prints, just fully opaque.
 */
function withOpacity(d: jsPDF, opacity: number, draw: () => void) {
	const g = d as jsPDF & { setGState?: (s: unknown) => void; GState?: (p: { opacity: number }) => unknown };
	const can = typeof g.setGState === 'function' && typeof g.GState === 'function';
	if (can) g.setGState!(g.GState!({ opacity }));
	draw();
	if (can) g.setGState!(g.GState!({ opacity: 1 }));
}

/** Light reference grid over the floorplan region (AC-6.3.1). */
function drawGrid(d: jsPDF, t: MapTheme, top: number, wMm: number, hMm: number) {
	const step = t.plan.grid.pitchMm;
	if (step <= 0) return;
	const c = rgb(t.plan.grid.color);
	d.setDrawColor(c[0], c[1], c[2]);
	d.setLineWidth(t.plan.grid.widthMm);
	for (let x = step; x < wMm; x += step) d.line(x, top, x, top + hMm);
	for (let y = top + step; y < top + hMm; y += step) d.line(0, y, wMm, y);
}

/** Corner anchor -> (x,y) for the north arrow, in page mm. */
function northAt(corner: Corner, t: MapTheme, top: number, wMm: number, hMm: number) {
	const { insetXMm, insetYMm } = t.plan.north;
	const left = corner === 'tl' || corner === 'bl';
	const upper = corner === 'tl' || corner === 'tr';
	return {
		x: left ? insetXMm : wMm - insetXMm,
		y: upper ? top + insetYMm : top + hMm - insetYMm
	};
}

/** A north arrow marker (AC-6.3.1: north-oriented).
 *
 * `deg` rotates the arrow clockwise from up, for a floor plan that was not
 * drawn with north at the top. The "N" glyph stays upright and level so it
 * remains readable at any rotation - only the arrow turns. */
function drawNorth(d: jsPDF, t: MapTheme, x: number, y: number, deg = 0) {
	const c = rgb(t.plan.north.color);
	const s = t.plan.north.sizeMm;
	const w = t.plan.north.wingMm;
	const rad = (deg * Math.PI) / 180;
	const rot = (px: number, py: number): [number, number] => [
		x + px * Math.cos(rad) - py * Math.sin(rad),
		y + px * Math.sin(rad) + py * Math.cos(rad)
	];
	const [tx, ty] = rot(0, -s);
	const [lx, ly] = rot(-w, w);
	const [rx, ry] = rot(w, w);
	d.setFillColor(c[0], c[1], c[2]);
	d.triangle(tx, ty, lx, ly, rx, ry, 'F');
	d.setTextColor(c[0], c[1], c[2]);
	d.setFont(t.typography.family, 'bold');
	d.setFontSize(t.typography.sizes.north);
	d.text(t.plan.north.label, x, y + t.plan.north.labelDyMm, { align: 'center' });
}

/** The scale bar, drawn only when the floor carries a known plan scale.
 *
 * A map that prints a bar it cannot justify is worse than one that prints
 * none, so an unknown, zero or negative scale draws nothing at all and the
 * "not to scale" footer note stands. */
function drawScaleBar(
	d: jsPDF,
	t: MapTheme,
	planScale: number | undefined,
	x: number,
	y: number,
	cropWmm: number
) {
	if (!t.plan.scaleBar.on) return;
	const choice = niceScaleLength(t.plan.scaleBar.lengthMm, planScale, 'metric', {
		widthMm: cropWmm
	});
	if (!choice) return;

	const c = rgb(t.plan.scaleBar.color);
	const h = t.plan.scaleBar.heightMm;
	const left = x - choice.barMm;
	for (const seg of scaleBarSegments(choice.barMm, 4)) {
		d.setFillColor(c[0], c[1], c[2]);
		d.setDrawColor(c[0], c[1], c[2]);
		d.setLineWidth(0.15);
		d.rect(left + seg.startMm, y, seg.endMm - seg.startMm, h, seg.filled ? 'F' : 'S');
	}
	d.setTextColor(c[0], c[1], c[2]);
	d.setFont(t.typography.family, 'normal');
	d.setFontSize(t.typography.sizes.north);
	d.text(choice.label, x, y + h + 3, { align: 'right' });
}

/** Header band composition: v1's three header *compositions* as one enum. */
function drawHeaderBand(d: jsPDF, t: MapTheme, wMm: number, hdrMm: number) {
	const { treatment } = t.header;
	if (treatment === 'none') return;
	const bg = rgb(t.header.bg);
	d.setFillColor(bg[0], bg[1], bg[2]);
	d.rect(0, 0, wMm, hdrMm, 'F');
	if (treatment === 'solid') return;

	const ink = rgb(t.header.treatmentColor);
	const pitch = Math.max(0.5, t.header.treatmentPitchMm);
	if (treatment === 'graph-rule') {
		d.setDrawColor(ink[0], ink[1], ink[2]);
		d.setLineWidth(t.header.treatmentWidthMm);
		for (let x = pitch; x < wMm; x += pitch) d.line(x, 0, x, hdrMm);
		for (let y = pitch; y < hdrMm; y += pitch) d.line(0, y, wMm, y);
		return;
	}
	// hazard-stripe: 45-degree bars, clipped to the band by construction.
	d.setFillColor(ink[0], ink[1], ink[2]);
	const bar = t.header.treatmentWidthMm;
	for (let x = -hdrMm; x < wMm; x += pitch) {
		d.triangle(x, hdrMm, x + hdrMm, 0, x + hdrMm + bar, 0, 'F');
		d.triangle(x, hdrMm, x + bar, hdrMm, x + hdrMm + bar, 0, 'F');
	}
}

// --- legend chip art --------------------------------------------------------
//
// v1 drew a distinct icon per legend chip (viewer.js:4039-4150) and v2 had
// flattened all of them to a plain circle, which made the theme's per-type
// `cell` ladder unreachable. The icons are back, but the style branching is
// not: the CONTAINER comes from the type's `shape` token and its size from the
// type's `cell` token, so the per-type table below is the only variance left.

/** A chip's box in mm: centre plus the themed cell size. */
export interface ChipBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** v1 chip geometry, as ratios of the themed cell. These are proportions, not
 *  appearance: every colour and every cell size is still a token. */
const CHIP = {
	/** Corner radius of a `rect` container. */
	radiusMm: 1.5,
	/** Inset of the icon from the cell's top and bottom edges. */
	insetMm: 1.8,
	/** Door frame, as a fraction of the cell. */
	doorFrameW: 0.6,
	doorFrameH: 0.52,
	doorKnobMm: 1.2,
	doorKnobInsetMm: 1.6,
	/** The staircase occupies the left 38% of the cell. */
	stairsColW: 0.38,
	stairsInsetMm: 1.5,
	stairsRuleGapMm: 2,
	/** The stairs label sits at 68% across the cell, right of the divider. */
	stairsLabelX: 0.68,
	/** Chevron half-width as a fraction of the cell, and its rise. */
	elevArmW: 0.32,
	elevArmRise: 0.75,
	elevUpY: 0.32,
	elevDnY: 0.55,
	elevRuleY: 0.64,
	elevRuleInsetMm: 2,
	/** Label baseline, up from the cell's bottom edge. */
	labelInsetMm: 2.2
} as const;

/** The chip container, in the type's own shape token. */
function chipBody(d: jsPDF, shape: MarkerShape, b: ChipBox, style: 'F' | 'S') {
	if (shape === 'diamond') {
		drawDiamond(d, b.x, b.y, b.w, b.h, style);
		return;
	}
	if (shape === 'circle') {
		d.circle(b.x, b.y, Math.min(b.w, b.h) / 2, style);
		return;
	}
	// rect keeps a small radius; badge and pill round all the way to a stadium.
	const r = shape === 'rect' ? CHIP.radiusMm : Math.min(b.w, b.h) / 2;
	d.roundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, r, r, style);
}

/** Fill the container in the chip's colour, then outline it in the chip ink. */
function chipShell(d: jsPDF, t: MapTheme, b: ChipBox, color: Rgb, shape: MarkerShape) {
	d.setFillColor(color[0], color[1], color[2]);
	chipBody(d, shape, b, 'F');
	const ink = rgb(t.legend.chipText);
	d.setDrawColor(ink[0], ink[1], ink[2]);
	d.setLineWidth(t.legend.chipBorderWidthMm);
	chipBody(d, shape, b, 'S');
}

/** Chip label, centred on (x,y) in the chip ink. */
function chipLabel(d: jsPDF, t: MapTheme, x: number, y: number, label: string) {
	const ink = rgb(t.legend.chipText);
	d.setTextColor(ink[0], ink[1], ink[2]);
	d.setFont(t.typography.family, 'bold');
	d.setFontSize(t.typography.sizes.legendChip);
	d.text(label, x, y, { align: 'center' });
}

/** Pen for the icon strokes inside a chip. */
function chipPen(d: jsPDF, t: MapTheme) {
	const ink = rgb(t.legend.chipText);
	d.setDrawColor(ink[0], ink[1], ink[2]);
	d.setLineWidth(t.legend.chipArtWidthMm);
}

type ChipArt = (d: jsPDF, t: MapTheme, b: ChipBox, label: string, color: Rgb, shape: MarkerShape) => void;

/** Door: a door-frame rect in the upper half, an accent knob, label below. */
const doorArt: ChipArt = (d, t, b, label, color, shape) => {
	chipShell(d, t, b, color, shape);
	const top = b.y - b.h / 2 + CHIP.insetMm;
	const fw = b.w * CHIP.doorFrameW;
	const fh = b.h * CHIP.doorFrameH;
	chipPen(d, t);
	d.rect(b.x - fw / 2, top, fw, fh, 'S');
	const acc = rgb(t.legend.accent);
	d.setFillColor(acc[0], acc[1], acc[2]);
	d.circle(
		b.x + fw / 2 - CHIP.doorKnobInsetMm + CHIP.doorKnobMm / 2,
		top + fh / 2,
		CHIP.doorKnobMm / 2,
		'F'
	);
	chipLabel(d, t, b.x, b.y + b.h / 2 - CHIP.labelInsetMm, label);
};

/** Stairs: a three-step staircase on the left, an accent divider, label right. */
const stairsArt: ChipArt = (d, t, b, label, color, shape) => {
	chipShell(d, t, b, color, shape);
	const left = b.x - b.w / 2 + CHIP.stairsInsetMm;
	const top = b.y - b.h / 2 + CHIP.insetMm;
	const iw = b.w * CHIP.stairsColW - CHIP.stairsInsetMm;
	const ih = b.h - CHIP.insetMm * 2;
	const step = iw / 3;
	chipPen(d, t);
	d.line(left, top + ih, left, top + ih * (2 / 3));
	d.line(left, top + ih * (2 / 3), left + step, top + ih * (2 / 3));
	d.line(left + step, top + ih * (2 / 3), left + step, top + ih / 3);
	d.line(left + step, top + ih / 3, left + 2 * step, top + ih / 3);
	d.line(left + 2 * step, top + ih / 3, left + 2 * step, top);
	d.line(left + 2 * step, top, left + 3 * step, top);
	const acc = rgb(t.legend.accent);
	d.setDrawColor(acc[0], acc[1], acc[2]);
	const ruleX = left + iw + CHIP.stairsRuleGapMm;
	d.line(ruleX, b.y - b.h / 2 + CHIP.stairsRuleGapMm, ruleX, b.y + b.h / 2 - CHIP.stairsRuleGapMm);
	chipLabel(d, t, b.x - b.w / 2 + b.w * CHIP.stairsLabelX, b.y + t.legend.chipTextDyMm, label);
};

/** Elevator: up and down chevrons over an accent rule, label below. v1 printed
 *  the number alone here, the type being obvious from the icon. */
const elevatorArt: ChipArt = (d, t, b, label, color, shape) => {
	chipShell(d, t, b, color, shape);
	const arm = b.w * CHIP.elevArmW;
	const rise = arm * CHIP.elevArmRise;
	const upY = b.y - b.h / 2 + b.h * CHIP.elevUpY;
	const dnY = b.y - b.h / 2 + b.h * CHIP.elevDnY;
	chipPen(d, t);
	d.line(b.x - arm, upY + rise, b.x, upY);
	d.line(b.x, upY, b.x + arm, upY + rise);
	d.line(b.x - arm, dnY - rise, b.x, dnY);
	d.line(b.x, dnY, b.x + arm, dnY - rise);
	const acc = rgb(t.legend.accent);
	d.setDrawColor(acc[0], acc[1], acc[2]);
	const ruleY = b.y - b.h / 2 + b.h * CHIP.elevRuleY;
	d.line(b.x - b.w / 2 + CHIP.elevRuleInsetMm, ruleY, b.x + b.w / 2 - CHIP.elevRuleInsetMm, ruleY);
	chipLabel(d, t, b.x, b.y + b.h / 2 - CHIP.labelInsetMm, label.replace(/^[A-Za-z]+/, ''));
};

/** Hallway and room: a rounded pill carrying the label. These two are
 *  style-invariant in v1 - their cells are identical across all three ladders -
 *  so the pill is their art whatever the type's pin shape is. */
const pillArt: ChipArt = (d, t, b, label, color) => {
	chipShell(d, t, b, color, 'pill');
	chipLabel(d, t, b.x, b.y + t.legend.chipTextDyMm, label);
};

const CHIP_ART: Record<MapMarkerType, ChipArt> = {
	door: doorArt,
	stairs: stairsArt,
	elevator: elevatorArt,
	hallway: pillArt,
	room: pillArt
};

/** Draw one legend chip: per-type icon, themed container shape, themed cell. */
export function drawLegendChip(
	d: jsPDF,
	t: MapTheme,
	type: MapMarkerType,
	box: ChipBox,
	label: string,
	color: string
) {
	CHIP_ART[type](d, t, box, label, rgb(color), t.types[type].shape);
}

// --- hallway areas ----------------------------------------------------------

/** v1 pill outline width and shadow opacity (viewer.js:3663-3670). */
const PILL_BORDER_MM = 0.55;
const PILL_SHADOW_OPACITY = 0.22;

/** The label pill v1 stamped at a hallway's centroid and at each extra label. */
function drawLabelPill(d: jsPDF, t: MapTheme, x: number, y: number, label: string, color: Rgb) {
	const w = t.hallway.pillWMm;
	const h = t.hallway.pillHMm;
	const r = h / 2;
	const off = t.plan.pinShadowMm;
	if (off > 0) {
		const sh = rgb(t.plan.pinShadow);
		withOpacity(d, PILL_SHADOW_OPACITY, () => {
			d.setFillColor(sh[0], sh[1], sh[2]);
			d.roundedRect(x - w / 2 + off, y - h / 2 + off, w, h, r, r, 'F');
		});
	}
	d.setFillColor(color[0], color[1], color[2]);
	d.roundedRect(x - w / 2, y - h / 2, w, h, r, r, 'F');
	const ink = rgb(t.plan.pinLabel);
	d.setDrawColor(ink[0], ink[1], ink[2]);
	d.setLineWidth(PILL_BORDER_MM);
	d.roundedRect(x - w / 2, y - h / 2, w, h, r, r, 'S');
	d.setTextColor(ink[0], ink[1], ink[2]);
	d.setFont(t.typography.family, 'bold');
	d.setFontSize(t.typography.sizes.pinLabel);
	d.text(label, x, y + t.plan.pinLabelDyMm, { align: 'center' });
}

/**
 * A hallway that carries a traced polygon prints as an AREA, not a pin: a
 * translucent fill, a dashed border in the label's palette colour, and a label
 * pill at the centroid plus one at each operator-placed extra label
 * (viewer.js:3632-3705). Extra pills are axis-snapped to the centroid by
 * layout.ts, and any that fall outside the crop are dropped.
 */
function drawHallwayArea(
	d: jsPDF,
	t: MapTheme,
	m: MapMarker,
	pts: Array<{ x: number; y: number }>,
	centre: { x: number; y: number },
	extras: Array<{ x: number; y: number }>,
	bounds: { top: number; wMm: number; hMm: number }
) {
	const color = rgb(hallwayColorFor(m.label, t.hallway.palette));
	// jsPDF paths are relative; the closing segment back to the first vertex is
	// explicit so the ring is shut for both the fill and the stroke.
	const segs = pts.slice(1).map((p, i) => [p.x - pts[i].x, p.y - pts[i].y]);
	segs.push([pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y]);

	withOpacity(d, t.hallway.fillOpacity, () => {
		d.setFillColor(color[0], color[1], color[2]);
		d.lines(segs, pts[0].x, pts[0].y, [1, 1], 'F', false);
	});

	d.setDrawColor(color[0], color[1], color[2]);
	d.setLineWidth(t.hallway.borderWidthMm);
	const [dash, gap] = t.hallway.dash;
	if (dash > 0) d.setLineDashPattern([dash, gap], 0);
	d.lines(segs, pts[0].x, pts[0].y, [1, 1], 'S', false);
	if (dash > 0) d.setLineDashPattern([], 0);

	drawLabelPill(d, t, centre.x, centre.y, m.label, color);
	for (const p of extras) {
		const outside =
			p.x < 0 || p.x > bounds.wMm || p.y < bounds.top || p.y > bounds.top + bounds.hMm;
		if (outside) continue;
		drawLabelPill(d, t, p.x, p.y, m.label, color);
	}
}

/** Per-type legend metadata, sourced from the theme rather than MAP_TYPES, so a
 *  facility can rename or recolour a type without touching the engine. */
function typeMetaOf(t: MapTheme): Record<MapMarkerType, { label: string; color: string }> {
	const out = {} as Record<MapMarkerType, { label: string; color: string }>;
	for (const [key, spec] of Object.entries(t.types) as Array<[MapMarkerType, MapTheme['types'][MapMarkerType]]>) {
		out[key] = { label: spec.displayName, color: spec.color };
	}
	return out;
}

/**
 * Build the NFPA map PDF. Returns the jsPDF doc (caller .save()s it). `mkDoc`
 * is a factory taking orientation + [w,h] mm so the caller owns the jsPDF
 * import.
 *
 * `style` selects a seeded preset and defaults to 'command'; `theme` layers a
 * partial theme on top of it (the last step of the org -> facility -> building
 * -> floor -> this-export cascade).
 */
export function buildMapPdf(
	mkDoc: (orientation: 'p' | 'l', size: [number, number]) => jsPDF,
	pages: ExportPageInput[],
	crops: Record<number, Crop>,
	buildingMarkers: MapMarker[],
	header: ExportHeader,
	style: PrintStyle = 'command',
	theme?: DeepPartial<MapTheme>
): jsPDF {
	const t: MapTheme = theme ? mergeThemes(themeForStyle(style), theme) : asTheme(style);
	const typeMeta = typeMetaOf(t);
	const pad = t.padMm;
	const hdrMm = t.header.heightMm;
	const footMm = t.footer.heightMm;
	// markerMm bakes in the DEFAULT header height, so a themed band shifts the
	// plan (and everything on it) by this much.
	const dy = hdrMm - HDR_MM;
	const today = formatDate(new Date(), t.output.dateFormat);

	// A floor stack built from separate PDFs has every source page numbered 1, so
	// page-number ordering (and a page-keyed crop map) cannot tell the floors
	// apart. When pages carry an explicit sortIndex, that is the stack order.
	const hasStackOrder = pages.some((p) => p.sortIndex !== undefined);
	const sorted = hasStackOrder
		? pages.slice().sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
		: orderPages(
				pages.map((p) => p.page),
				crops
			)
				.map((n) => pages.find((p) => p.page === n)!)
				.filter(Boolean);

	let doc: jsPDF | null = null;
	sorted.forEach((pg, idx) => {
		const crop = pg.crop ?? crops[pg.page];
		const cp = cropPx(crop, pg.canvasW, pg.canvasH);
		const pageMarkers = pg.markers;
		const legItems = buildLegendItems(pageMarkers, buildingMarkers, typeMeta, t);
		const legH = legendHeight(legItems, t);
		const sz = pageSizeMm(cp.w, cp.h, legH);
		const wMm = sz.wMm;
		const hMm = hdrMm + sz.cropHmm + legH + footMm;
		const orientation: 'p' | 'l' = wMm >= hMm ? 'l' : 'p';

		if (!doc) doc = mkDoc(orientation, [wMm, hMm]);
		else doc.addPage([wMm, hMm], orientation);
		const d = doc;

		// Header band.
		drawHeaderBand(d, t, wMm, hdrMm);
		const titleX = pad + t.header.logoZoneMm;
		if (t.header.eyebrow) {
			const c = rgb(t.header.tert);
			d.setTextColor(c[0], c[1], c[2]);
			d.setFont(t.typography.family, 'bold');
			d.setFontSize(t.typography.sizes.eyebrow);
			d.text(t.header.eyebrow, titleX, t.header.eyebrowBaselineMm);
		}
		const htx = rgb(t.header.text);
		d.setTextColor(htx[0], htx[1], htx[2]);
		d.setFont(t.typography.family, 'bold');
		d.setFontSize(t.typography.sizes.facility);
		d.text(header.facilityName, titleX, t.header.titleBaselineMm);
		d.setFont(t.typography.family, 'normal');
		d.setFontSize(t.typography.sizes.address);
		const sub = [header.address, header.zip, header.phone].filter(Boolean).join(t.header.subSeparator);
		if (sub) {
			const sc = rgb(t.header.sub);
			d.setTextColor(sc[0], sc[1], sc[2]);
			d.text(sub, titleX, t.header.subBaselineMm);
		}
		if (t.header.stripeMm > 0) {
			const ac = rgb(t.accent);
			d.setFillColor(ac[0], ac[1], ac[2]);
			d.rect(0, hdrMm - t.header.stripeMm, wMm, t.header.stripeMm, 'F');
		}
		d.setFontSize(t.typography.sizes.floorLine);
		const tc = rgb(t.header.tert);
		d.setTextColor(tc[0], tc[1], tc[2]);
		// The floor's own label wins ("0", "Main", "3"); a page-derived "Floor N of
		// M" is only a fallback for an unlabelled floor.
		const floorText = pg.floorLabel || floorLine(crop, idx + 1, sorted.length);
		d.text(
			fillTokens(t.header.floorLineFormat, {
				name: t.name,
				floor: floorText,
				page: idx + 1,
				pages: sorted.length,
				date: today,
				facility: header.facilityName
			}),
			wMm - pad,
			t.header.titleBaselineMm,
			{ align: 'right' }
		);

		// Floorplan image (cropped region scaled to crop mm box under the header).
		d.addImage(pg.imageDataUrl, t.output.imageFormat, 0, hdrMm, sz.cropWmm, sz.cropHmm);
		if (t.plan.borderWidthMm > 0) {
			const bc = rgb(t.plan.border);
			d.setDrawColor(bc[0], bc[1], bc[2]);
			d.setLineWidth(t.plan.borderWidthMm);
			d.rect(0, hdrMm, sz.cropWmm, sz.cropHmm, 'S');
		}
		// Reference grid + north arrow over the floorplan (AC-6.3.1: north-oriented,
		// gridded print layout).
		if (t.plan.grid.on) drawGrid(d, t, hdrMm, sz.cropWmm, sz.cropHmm);
		drawScaleBar(d, t, pg.planScale, sz.cropWmm - pad, hdrMm + sz.cropHmm - 8, sz.cropWmm);
		if (t.plan.north.on) {
			const at = northAt(t.plan.north.corner, t, hdrMm, sz.cropWmm, sz.cropHmm);
			drawNorth(d, t, at.x, at.y, pg.northDeg ?? 0);
		}

		// Hallway areas, over the floorplan and under the pins. A hallway with no
		// traced polygon has no area to fill, so it stays a pin.
		const asArea = new Set<string>();
		for (const m of pageMarkers) {
			if (m.type !== 'hallway' || (m.points?.length ?? 0) < 3) continue;
			asArea.add(m.id);
			const toMm = (p: { nx: number; ny: number }) => {
				const q = markerMm(p, pg.canvasW, pg.canvasH, cp.x, cp.y);
				return { x: q.x, y: q.y + dy };
			};
			const centre = toMm(m);
			drawHallwayArea(
				d,
				t,
				m,
				m.points!.map(toMm),
				centre,
				alignExtraLabels(
					centre,
					(m.extraLabels ?? []).map(toMm)
				),
				{ top: hdrMm, wMm: sz.cropWmm, hMm: sz.cropHmm }
			);
		}

		// Markers: themed pin (shadow + fill) then label.
		for (const m of pageMarkers) {
			if (asArea.has(m.id)) continue;
			const spec = t.types[m.type];
			const p = markerMm(m, pg.canvasW, pg.canvasH, cp.x, cp.y);
			drawPin(d, p.x, p.y + dy, rgb(spec.color), spec.shape, t, spec.sizeMm);
			const lc = rgb(spec.labelColor);
			d.setTextColor(lc[0], lc[1], lc[2]);
			d.setFont(t.typography.family, 'bold');
			d.setFontSize(spec.labelPt);
			d.text(m.label, p.x, p.y + dy + t.plan.pinLabelDyMm, { align: 'center' });
		}

		// Legend block under the floorplan.
		const legTop = hdrMm + sz.cropHmm;
		if (t.plan.dividerWidthMm > 0) {
			const dc = rgb(t.plan.divider);
			d.setDrawColor(dc[0], dc[1], dc[2]);
			d.setLineWidth(t.plan.dividerWidthMm);
			d.line(0, legTop, wMm, legTop);
		}
		const lbg = rgb(t.legend.bg);
		d.setFillColor(lbg[0], lbg[1], lbg[2]);
		d.rect(0, legTop, wMm, legH, 'F');
		const ltx = rgb(t.legend.text);
		d.setTextColor(ltx[0], ltx[1], ltx[2]);
		d.setFont(t.typography.family, 'bold');
		d.setFontSize(t.typography.sizes.legendHeader);
		d.text(t.legend.headerText, pad, legTop + t.legend.headerBaselineMm);

		if (legItems.length === 0 && t.legend.emptyText) {
			const ec = rgb(t.legend.sub);
			d.setTextColor(ec[0], ec[1], ec[2]);
			d.setFont(t.typography.family, 'normal');
			d.setFontSize(t.typography.sizes.legendType);
			d.text(t.legend.emptyText, pad, legTop + t.legend.headerHMm + t.legend.rowTextDyMm * 4);
		}

		const iconX = pad + t.legend.iconOffsetMm;
		const nameX = iconX + t.legend.iconColWidthMm + t.legend.nameGapMm;
		const countX = wMm - pad - t.legend.countInsetMm;
		let cursorY = legTop + t.legend.headerHMm;
		legItems.forEach((item, i) => {
			const lay = layoutItem(item, t);
			const rowCY = cursorY + lay.rowH / 2;
			if (i > 0) {
				const bc = rgb(t.legend.border);
				d.setDrawColor(bc[0], bc[1], bc[2]);
				d.setLineWidth(t.legend.dividerWidthMm);
				d.line(pad, cursorY, wMm - pad, cursorY);
			}
			// chips: per-type icon art, in the type's shape, at the type's cell size
			for (const chip of placeChips(item, lay, iconX, rowCY, t)) {
				drawLegendChip(
					d,
					t,
					item.type,
					{ x: chip.x, y: chip.y, w: lay.cell.w, h: lay.cell.h },
					chip.label,
					chip.color
				);
			}
			// type name + counts
			d.setTextColor(ltx[0], ltx[1], ltx[2]);
			d.setFont(t.typography.family, 'bold');
			d.setFontSize(t.typography.sizes.legendType);
			d.text(item.typeName.toUpperCase(), nameX, rowCY + t.legend.rowTextDyMm);
			const mc = rgb(t.legend.muted);
			d.setTextColor(mc[0], mc[1], mc[2]);
			d.setFont(t.typography.family, 'normal');
			d.setFontSize(t.typography.sizes.legendCount);
			d.text(
				fillTokens(t.legend.countFormat, { count: item.count, buildingCount: item.buildingCount }),
				countX,
				rowCY + t.legend.rowTextDyMm,
				{ align: 'right' }
			);
			cursorY += lay.rowH;
		});

		// Footer.
		if (t.footer.bg) {
			const fbg = rgb(t.footer.bg);
			d.setFillColor(fbg[0], fbg[1], fbg[2]);
			d.rect(0, hMm - footMm, wMm, footMm, 'F');
		}
		d.setFontSize(t.typography.sizes.footer);
		const ftx = rgb(t.footer.text);
		d.setTextColor(ftx[0], ftx[1], ftx[2]);
		d.text(
			fillTokens(t.footer.strapline, {
				brand: header.brandName ?? 'Pathfinder',
				facility: header.facilityName,
				date: today
			}),
			pad,
			hMm - t.footer.baselineMm
		);
		if (t.footer.pageFormat) {
			d.text(
				fillTokens(t.footer.pageFormat, { page: idx + 1, pages: sorted.length }),
				wMm - pad,
				hMm - t.footer.baselineMm,
				{ align: 'right' }
			);
		}
	});

	return doc!;
}

/** Safe filename for the export (v1: facility name slug), themed by
 *  `output.filenamePattern`. */
export function exportFilename(facilityName: string, theme?: DeepPartial<MapTheme> | PrintStyle): string {
	const t = asTheme(theme);
	return fillTokens(t.output.filenamePattern, {
		facility: facilityName.replace(/[^a-z0-9]/gi, '_'),
		date: formatDate(new Date(), t.output.dateFormat)
	});
}
