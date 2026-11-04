// 2D annotation engine - coordinate conversion (Epic E5).
//
// Three spaces: screen (clientX/Y) -> canvas pixels -> normalized [0,1].
// Ported verbatim from v1 canvasXY/toNorm. Parametrized on dims/rect instead
// of reading DOM globals, so it is pure and unit-testable.

import type { CanvasDims, ElementRect } from './types';

/** Screen client coords -> canvas pixel coords, accounting for CSS scaling of
 *  the canvas element (v1 canvasXY). */
export function screenToCanvas(
	clientX: number,
	clientY: number,
	rect: ElementRect,
	dims: CanvasDims
): { x: number; y: number } {
	const scaleX = dims.width / rect.width;
	const scaleY = dims.height / rect.height;
	return {
		x: (clientX - rect.left) * scaleX,
		y: (clientY - rect.top) * scaleY
	};
}

/** Canvas pixel rect -> normalized [0,1] (v1 toNorm). x,w divide by width;
 *  y,h divide by height. */
export function toNorm(
	x: number,
	y: number,
	w: number,
	h: number,
	dims: CanvasDims
): { nx: number; ny: number; nw: number; nh: number } {
	return {
		nx: x / dims.width,
		ny: y / dims.height,
		nw: w / dims.width,
		nh: h / dims.height
	};
}

/** Normalized -> canvas pixels. */
export function fromNorm(
	nx: number,
	ny: number,
	nw: number,
	nh: number,
	dims: CanvasDims
): { x: number; y: number; w: number; h: number } {
	return {
		x: nx * dims.width,
		y: ny * dims.height,
		w: nw * dims.width,
		h: nh * dims.height
	};
}

/** Auto-fit scale for a page in a given viewport (v1 calcFitScale).
 *  Reserves 80px of chrome; never zooms below 0.25. */
export function calcFitScale(areaWidth: number, pageWidth: number): number {
	if (pageWidth <= 0) return 1;
	return Math.max((areaWidth - 80) / pageWidth, 0.25);
}

/** Clamp a zoom scale to the v1 range [0.25, 5]. */
export function clampScale(scale: number): number {
	return Math.min(Math.max(scale, 0.25), 5);
}
