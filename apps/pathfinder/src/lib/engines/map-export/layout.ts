// Map engine - export page layout math (Epic E6).
//
// Page ordering, crop -> millimetre conversion, page sizing, marker placement,
// hex->rgb, and the export-time hallway extra-label axis-snap. Ported verbatim
// from v1 _runMapExport. Pure - the jsPDF drawing lives browser-side.

import type { MapMarker } from './markers';

// v1 export constants.
export const PT2MM = 25.4 / 72;
export const RENDER_SCALE = 2.0;
export const PX2MM = PT2MM / RENDER_SCALE;
export const ALIGN_MM = 4;

export interface Crop {
	nx: number;
	ny: number;
	nw: number;
	nh: number;
	label?: string;
	printOrder?: number;
}

/**
 * Order pages for the multi-page export (v1 lines 3335-3340). printOrder
 * overrides; otherwise the page falls back to its own page number, preserving
 * document order. `pages` is the 1-based page list; `crops` maps page->crop.
 */
export function orderPages(pages: number[], crops: Record<number, Crop>): number[] {
	return pages
		.slice()
		.sort((a, b) => (crops[a]?.printOrder || a) - (crops[b]?.printOrder || b));
}

/** Pixel crop rect for a page given the rendered canvas dims. Full page when
 *  no crop is set (v1). Returns integer px. */
export function cropPx(
	crop: Crop | undefined,
	canvasW: number,
	canvasH: number
): { x: number; y: number; w: number; h: number } {
	if (!crop) return { x: 0, y: 0, w: canvasW, h: canvasH };
	return {
		x: Math.round(crop.nx * canvasW),
		y: Math.round(crop.ny * canvasH),
		w: Math.round(crop.nw * canvasW),
		h: Math.round(crop.nh * canvasH)
	};
}

/** Page dimensions in mm (v1): width = crop width; height = header + crop +
 *  legend + footer. */
export function pageSizeMm(
	cropWpx: number,
	cropHpx: number,
	legHmm: number
): { wMm: number; hMm: number; cropWmm: number; cropHmm: number } {
	const cropWmm = cropWpx * PX2MM;
	const cropHmm = cropHpx * PX2MM;
	return {
		cropWmm,
		cropHmm,
		wMm: cropWmm,
		hMm: HDR_MM + cropHmm + legHmm + FOOTER_H_MM
	};
}

// Re-export the header/footer constants used in pageSizeMm so callers have one
// source of truth (kept in sync with legend.ts).
import { HDR_MM, FOOTER_H_MM } from './legend';
export { HDR_MM, FOOTER_H_MM };

/** Place a marker into page-mm coords given the crop origin (v1). */
export function markerMm(
	m: { nx: number; ny: number },
	canvasW: number,
	canvasH: number,
	cropX: number,
	cropY: number
): { x: number; y: number } {
	return {
		x: (m.nx * canvasW - cropX) * PX2MM,
		y: HDR_MM + (m.ny * canvasH - cropY) * PX2MM
	};
}

/** Hex colour -> [r,g,b] (v1 _hexToRgb). */
export function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.replace('#', ''), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Export-time hallway extra-label axis-snap (v1 lines 3669-3704). Pins within
 * ALIGN_MM of an anchor (the centroid) or of an already-snapped pin are pulled
 * into alignment on each axis independently. `pinsMm` are pin centres in mm;
 * the centroid (index 0 conceptually) is the anchor. Returns adjusted copies.
 */
export function alignExtraLabels(
	centroidMm: { x: number; y: number },
	pinsMm: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
	const all = [{ ...centroidMm, anchor: true }, ...pinsMm.map((p) => ({ ...p, anchor: false }))];
	for (let i = 1; i < all.length; i++) {
		for (let j = 0; j < i; j++) {
			if (Math.abs(all[i].x - all[j].x) <= ALIGN_MM) all[i].x = all[j].x;
			if (Math.abs(all[i].y - all[j].y) <= ALIGN_MM) all[i].y = all[j].y;
		}
	}
	return all.slice(1).map((p) => ({ x: p.x, y: p.y }));
}

/** Minimum normalized crop dimension (v1: 0.02). */
export const MIN_CROP = 0.02;

/** Normalize a drawn crop rect: fold negative width/height to a positive
 *  top-left origin, clamp into [0,1], and reject (return null) anything smaller
 *  than MIN_CROP in either axis (v1 crop draw rules). */
export function normalizeCrop(
	nx: number,
	ny: number,
	nw: number,
	nh: number
): { nx: number; ny: number; nw: number; nh: number } | null {
	let x = nw < 0 ? nx + nw : nx;
	let y = nh < 0 ? ny + nh : ny;
	let w = Math.abs(nw);
	let h = Math.abs(nh);
	// clamp the box inside the page
	if (x < 0) {
		w += x;
		x = 0;
	}
	if (y < 0) {
		h += y;
		y = 0;
	}
	if (x + w > 1) w = 1 - x;
	if (y + h > 1) h = 1 - y;
	if (w < MIN_CROP || h < MIN_CROP) return null;
	return { nx: x, ny: y, nw: w, nh: h };
}

/** Floor line for the page footer/header (v1 _floorLine). */
export function floorLine(crop: Crop | undefined, pageIndex: number, total: number): string {
	return crop?.label || `Floor ${pageIndex} of ${total}`;
}

/** Build the count caption shown right-aligned in the legend (v1; the middle-dot
 *  separator is rendered as an ASCII bullet to keep committed source ASCII-only). */
export function countCaption(onFloor: number, buildingTotal: number): string {
	return `${onFloor} on floor  -  ${buildingTotal} total`;
}

export type { MapMarker };
