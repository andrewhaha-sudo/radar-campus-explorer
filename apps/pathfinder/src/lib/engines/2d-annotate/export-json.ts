// 2D annotation engine - JSON export schema 1.0 + comment numbering (Epic E5).
//
// Ported from v1 updateJSONPreview. The export envelope groups annotations by
// page and renames nx/ny/nw/nh -> x/y/w/h rounded to 4 decimals. Comment
// numbering is GLOBAL by createdAt across all pages (v1 _commentNums), not
// per-page. Pure - no DOM.

import type { Annotation } from './types';

const r4 = (n: number) => +n.toFixed(4);

export interface ExportEnvelope {
	document: {
		id: string;
		name: string;
		exportedAt: string;
		totalAnnotations: number;
		pages: Array<{
			pageNumber: number;
			annotations: Array<{
				id: string;
				type: string;
				x: number;
				y: number;
				w: number;
				h: number;
				color: string;
				text?: string;
				images?: string[];
				points?: Array<[number, number]>;
				resolved?: boolean;
				createdBy?: string;
				createdAt?: string;
			}>;
		}>;
	};
}

/**
 * Build the schema-1.0 export envelope for a document. `exportedAt` is injected
 * so the output is deterministic and testable. Pages are emitted in ascending
 * page order; only pages that have annotations appear.
 */
export function buildExport(
	docId: string,
	docName: string,
	annotations: Annotation[],
	exportedAt: string
): ExportEnvelope {
	const byPage = new Map<number, Annotation[]>();
	for (const a of annotations) {
		const arr = byPage.get(a.page) ?? [];
		arr.push(a);
		byPage.set(a.page, arr);
	}
	const pages = [...byPage.keys()]
		.sort((a, b) => a - b)
		.map((pageNumber) => ({
			pageNumber,
			annotations: (byPage.get(pageNumber) as Annotation[]).map((a) => ({
				id: a.id,
				type: a.type,
				x: r4(a.nx),
				y: r4(a.ny),
				w: r4(a.nw),
				h: r4(a.nh),
				color: a.color,
				text: a.text,
				images: a.images && a.images.length ? a.images : undefined,
				points: a.points || undefined,
				resolved: a.resolved,
				createdBy: a.createdBy,
				createdAt: a.createdAt
			}))
		}));

	return {
		document: {
			id: docId,
			name: docName,
			exportedAt,
			totalAnnotations: annotations.length,
			pages
		}
	};
}

/**
 * Inverse of buildExport: parse a schema-1.0 envelope back into Annotation[]
 * (AC-5.3.2 round-trip). Coordinates x/y/w/h map back to nx/ny/nw/nh.
 */
export function importEnvelope(env: ExportEnvelope): Annotation[] {
	const out: Annotation[] = [];
	for (const page of env.document.pages) {
		for (const a of page.annotations) {
			out.push({
				id: a.id,
				page: page.pageNumber,
				type: a.type as Annotation['type'],
				nx: a.x,
				ny: a.y,
				nw: a.w,
				nh: a.h,
				points: a.points,
				color: a.color,
				text: a.text,
				images: a.images,
				resolved: a.resolved,
				createdBy: a.createdBy,
				createdAt: a.createdAt
			});
		}
	}
	return out;
}

/**
 * Assign comment numbers globally across all pages, ordered by createdAt
 * (v1 _commentNums). Returns a Map of annotation id -> 1-based number for
 * every annotation of type 'comment'. Annotations with no createdAt sort last
 * by id, deterministically.
 */
export function commentNumbers(annotations: Annotation[]): Map<string, number> {
	const comments = annotations
		.filter((a) => a.type === 'comment')
		.slice()
		.sort((a, b) => {
			const ca = a.createdAt ?? '';
			const cb = b.createdAt ?? '';
			if (ca !== cb) return ca < cb ? -1 : 1;
			return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
		});
	const nums = new Map<string, number>();
	comments.forEach((a, i) => nums.set(a.id, i + 1));
	return nums;
}
