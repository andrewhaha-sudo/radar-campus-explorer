// Browser-side glue (Epic E6): render a document's pages with PDF.js and
// produce the NFPA map PDF via the tested engine. Shared by the single-doc
// viewer export and the batch export pipeline so they cannot drift. Pure layout
// math stays in legend.ts/layout.ts/pages.ts; this only does PDF.js render + jsPDF emit.

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { buildMapPdf, exportFilename, type ExportPageInput } from './export-pdf';
import type { MapMarker } from './markers';
import { pagesToExport } from './pages';

export interface DocExportInput {
	docId: string;
	filename: string;
	fileUrl: string;
	markers: MapMarker[];
}

export interface ExportResult {
	ok: boolean;
	error?: string;
}

/** Render the pages carrying markers to JPEG data URLs. Throws if the PDF cannot be
 *  fetched or parsed - callers decide whether that is fatal. */
async function renderPages(fileUrl: string, markers: MapMarker[]): Promise<ExportPageInput[]> {
	const pdfjs = await import('pdfjs-dist');
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	const res = await fetch(fileUrl);
	if (!res.ok) throw new Error(`Could not fetch the source PDF (HTTP ${res.status}).`);
	const buf = await res.arrayBuffer();
	const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;

	const out: ExportPageInput[] = [];
	for (const n of pagesToExport(markers, doc.numPages)) {
		const page = await doc.getPage(n);
		const viewport = page.getViewport({ scale: 2 });
		const canvas = document.createElement('canvas');
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		const ctx = canvas.getContext('2d')!;
		// White-fill first: transparent PDF backgrounds otherwise bleed dark in JPEG.
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		await page.render({ canvasContext: ctx, viewport }).promise;
		out.push({
			page: n,
			imageDataUrl: canvas.toDataURL('image/jpeg', 0.95),
			canvasW: canvas.width,
			canvasH: canvas.height,
			markers: markers.filter((m) => m.page === n)
		});
	}
	return out;
}

/** Build + download the NFPA map PDF for one document, one output page per source
 *  page carrying markers. A missing or unreadable PDF is reported, never faked: an
 *  empty page under a legend reads as a successful export of a building with no plan. */
export async function exportDocMap(input: DocExportInput): Promise<ExportResult> {
	const { default: JsPDF } = await import('jspdf');
	let pages: ExportPageInput[];
	try {
		pages = await renderPages(input.fileUrl, input.markers);
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Could not read the source PDF.' };
	}
	const facilityName = input.filename.replace(/\.[^.]+$/, '');
	const doc = buildMapPdf(
		(orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }),
		pages,
		{},
		input.markers,
		{ facilityName, brandName: 'Pathfinder' }
	);
	doc.save(exportFilename(input.filename));
	return { ok: true };
}
