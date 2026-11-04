// 2D annotation engine - shared types (Epic E5).
//
// Ported from v1 els911-portal/public/js/viewer.js. The engine stores
// coordinates normalized to [0,1] of page dimensions so they are
// resolution-independent and portable across zoom levels and export scales.
// This module is framework-agnostic (no DOM, no PDF.js) so it is unit-testable.

/** The 12 annotation tool types (v1 parity). */
export type AnnotationType =
	| 'circle'
	| 'rect'
	| 'arrow'
	| 'freehand'
	| 'comment'
	| 'correction'
	| 'aed'
	| 'stairs'
	| 'door'
	| 'overhead'
	| 'exit'
	| 'fireext';

/** Tools that render as a pinned safety marker (tip at nx,ny; nw=nh=0). */
export const MARKER_TOOLS: AnnotationType[] = [
	'aed',
	'stairs',
	'door',
	'overhead',
	'exit',
	'fireext'
];

/** Per-marker render metadata (label badge + background colour), v1 parity. */
export const MARKER_META: Record<string, { label: string; bg: string }> = {
	aed: { label: 'AED', bg: '#1565C0' },
	stairs: { label: 'STR', bg: '#D97706' },
	door: { label: 'DOOR', bg: '#059669' },
	overhead: { label: 'OVR', bg: '#7C3AED' },
	exit: { label: 'EXIT', bg: '#059669' },
	fireext: { label: 'FIRE', bg: '#B22234' }
};

/** Default stroke colour for new annotations (v1 default). */
export const DEFAULT_COLOR = '#B22234';

/** Undo stack depth cap (v1: 50). */
export const UNDO_CAP = 50;

/**
 * Pin geometry: stored (nx,ny) is the pin TIP. The circle body centre sits
 * PIN_TIP_OFFSET canvas-px above the tip (v1: r 14 + tail 10 = 24). Shared by
 * the renderer and the hit-tester so they agree.
 */
export const PIN_TIP_OFFSET = 24;
export const PIN_RADIUS = 14;

/** Minimum drag distance (canvas px) before a shape is committed (v1). */
export const MIN_SHAPE_PX = 5;

/** A single annotation. Markers/comments carry nw=nh=0; freehand carries points
 *  and no bbox. nw/nh may be negative (arrow/drag up-left) - never normalise away. */
export interface Annotation {
	id: string;
	page: number; // 1-based
	type: AnnotationType;
	nx: number;
	ny: number;
	nw: number;
	nh: number;
	points?: Array<[number, number]>; // freehand only, normalized
	color: string;
	text?: string;
	images?: string[];
	linkedAnnotationId?: string | null;
	resolved?: boolean;
	createdAt?: string;
	createdBy?: string;
}

/** Pixel dimensions of the canvas a normalized annotation is drawn onto. */
export interface CanvasDims {
	width: number;
	height: number;
}

/** Bounding rect of a DOM canvas element (for screen->canvas mapping). */
export interface ElementRect {
	left: number;
	top: number;
	width: number;
	height: number;
}
