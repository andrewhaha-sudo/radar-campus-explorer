// 2D annotation engine - canvas renderer (Epic E5).
//
// Browser-side: takes a CanvasRenderingContext2D and draws annotations from the
// pure model. Geometry comes from the pure modules; this file only issues
// Canvas2D calls. Ported from v1 drawAnnotation/drawArrow/drawMarker/
// drawCommentPin. Kept out of the pure test surface (needs a canvas context).

import {
	MARKER_META,
	MARKER_TOOLS,
	PIN_RADIUS,
	PIN_TIP_OFFSET,
	type Annotation,
	type CanvasDims
} from './types';

type Ctx = CanvasRenderingContext2D;

function drawArrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string) {
	const hl = 14;
	const ang = Math.atan2(y2 - y1, x2 - x1);
	const bx = x2 - Math.cos(ang) * hl * 0.5;
	const by = y2 - Math.sin(ang) * hl * 0.5;
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(bx, by);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x2, y2);
	ctx.lineTo(x2 - Math.cos(ang - 0.4) * hl, y2 - Math.sin(ang - 0.4) * hl);
	ctx.lineTo(x2 - Math.cos(ang + 0.4) * hl, y2 - Math.sin(ang + 0.4) * hl);
	ctx.closePath();
	ctx.fill();
}

function drawMarker(ctx: Ctx, cxTip: number, cyTip: number, label: string, bg: string) {
	const cx = cxTip;
	const cy = cyTip - PIN_TIP_OFFSET; // body centre above the tip
	// tail
	ctx.fillStyle = bg;
	ctx.beginPath();
	ctx.moveTo(cx - 6, cy + PIN_RADIUS - 4);
	ctx.lineTo(cx + 6, cy + PIN_RADIUS - 4);
	ctx.lineTo(cx, cyTip);
	ctx.closePath();
	ctx.fill();
	// body
	ctx.beginPath();
	ctx.arc(cx, cy, PIN_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#fff';
	ctx.font = '700 9px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, cx, cy);
}

function drawCommentPin(ctx: Ctx, cxTip: number, cyTip: number, num: number, text: string, color: string, cw: number) {
	const cx = cxTip;
	const cy = cyTip - PIN_TIP_OFFSET;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(cx, cy, PIN_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#fff';
	ctx.font = '700 11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(String(num), cx, cy);
	if (text) {
		const snippet = text.length > 42 ? text.slice(0, 42) + '...' : text;
		ctx.font = '11px system-ui, sans-serif';
		const bw = ctx.measureText(snippet).width + 12;
		const gap = 6;
		let bx = cx + PIN_RADIUS + gap;
		if (bx + bw > cw - 8) bx = cx - PIN_RADIUS - gap - bw; // flip left
		ctx.fillStyle = 'rgba(15,23,42,0.92)';
		ctx.fillRect(bx, cy - 9, bw, 18);
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'left';
		ctx.fillText(snippet, bx + 6, cy);
	}
}

/** Draw a single annotation onto the overlay canvas (v1 drawAnnotation). */
export function drawAnnotation(
	ctx: Ctx,
	a: Annotation,
	dims: CanvasDims,
	opts: { selected?: boolean; commentNum?: number } = {}
) {
	const cw = dims.width;
	const ch = dims.height;
	const x = a.nx * cw;
	const y = a.ny * ch;
	const w = a.nw * cw;
	const h = a.nh * ch;
	const color = a.color || '#B22234';
	ctx.save();
	ctx.lineWidth = opts.selected ? 3.5 : 2.5;
	if (opts.selected) ctx.setLineDash([6, 3]);
	ctx.strokeStyle = color;

	if (a.type === 'circle') {
		ctx.beginPath();
		ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
		ctx.stroke();
	} else if (a.type === 'rect') {
		ctx.fillStyle = color + '18';
		ctx.fillRect(x, y, w, h);
		ctx.strokeRect(x, y, w, h);
	} else if (a.type === 'arrow') {
		drawArrow(ctx, x, y, x + w, y + h, color);
	} else if (a.type === 'freehand' && a.points && a.points.length > 1) {
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(a.points[0][0] * cw, a.points[0][1] * ch);
		for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i][0] * cw, a.points[i][1] * ch);
		ctx.stroke();
	} else if (a.type === 'correction') {
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + w, y + h);
		ctx.moveTo(x + w, y);
		ctx.lineTo(x, y + h);
		ctx.stroke();
		ctx.strokeStyle = color + 'aa';
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, w, h);
	} else if (a.type === 'comment') {
		drawCommentPin(ctx, x, y, opts.commentNum ?? 0, a.text ?? '', color, cw);
	} else if (MARKER_TOOLS.includes(a.type)) {
		const meta = MARKER_META[a.type];
		drawMarker(ctx, x, y, meta.label, meta.bg);
	}
	ctx.restore();
}

/** Clear and redraw every annotation on the current page. */
export function renderAnnotations(
	ctx: Ctx,
	annotations: Annotation[],
	page: number,
	dims: CanvasDims,
	commentNums: Map<string, number>,
	selectedId: string | null
) {
	ctx.clearRect(0, 0, dims.width, dims.height);
	for (const a of annotations) {
		if (a.page !== page) continue;
		drawAnnotation(ctx, a, dims, {
			selected: a.id === selectedId,
			commentNum: commentNums.get(a.id)
		});
	}
}
