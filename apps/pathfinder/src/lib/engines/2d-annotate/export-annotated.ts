// Annotated PDF export (Epic E5, v1 export-annotated-btn). Assembles a
// multi-page PDF from page images that already have annotations composited onto
// them (the caller renders each PDF page + draws annotations via the engine
// renderer, then hands the composited data URLs here). This file only does the
// jsPDF page sizing + emit, mirroring v1's EXPORT_SCALE/mm math. Browser-side.

import type jsPDF from 'jspdf';

const PT2MM = 25.4 / 72;
export const EXPORT_SCALE = 1.5; // v1 EXPORT_SCALE

export interface AnnotatedPage {
	imageDataUrl: string; // composited (floorplan + annotations) JPEG/PNG
	wPx: number;
	hPx: number;
}

/** Build the annotated PDF. Page size in mm derives from the rendered pixel
 *  size at EXPORT_SCALE (v1: cw/EXPORT_SCALE * 25.4/72); orientation per page
 *  by aspect ratio. Returns the jsPDF doc for the caller to save. */
export function buildAnnotatedPdf(
	mkDoc: (orientation: 'p' | 'l', size: [number, number]) => jsPDF,
	pages: AnnotatedPage[]
): jsPDF {
	let doc: jsPDF | null = null;
	for (const pg of pages) {
		const wMm = (pg.wPx / EXPORT_SCALE) * PT2MM;
		const hMm = (pg.hPx / EXPORT_SCALE) * PT2MM;
		const orientation: 'p' | 'l' = wMm >= hMm ? 'l' : 'p';
		if (!doc) doc = mkDoc(orientation, [wMm, hMm]);
		else doc.addPage([wMm, hMm], orientation);
		doc.addImage(pg.imageDataUrl, 'JPEG', 0, 0, wMm, hMm);
	}
	return doc as jsPDF;
}
