<script lang="ts">
	// 2D floorplan annotation viewer (Epic E5). Hosts PDF.js + a canvas overlay
	// and drives the framework-agnostic engine modules. Falls back to a demo
	// floorplan when object storage is not yet wired (E7/S4) so the tooling stays
	// demonstrable. Map markers + NFPA export (E6) layer on in the map panel.
	import { onMount, onDestroy } from 'svelte';
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
	import type { PageData } from './$types';
	import { screenToCanvas, toNorm, calcFitScale, clampScale } from '$lib/engines/2d-annotate/coords';
	import { newHistory, pushUndo, undo as doUndo, redo as doRedo } from '$lib/engines/2d-annotate/undo';
	import { hitTest } from '$lib/engines/2d-annotate/hittest';
	import { commentNumbers, buildExport } from '$lib/engines/2d-annotate/export-json';
	import { renderAnnotations, drawAnnotation } from '$lib/engines/2d-annotate/render';
	import { translateAnnotation, clampAnnotation } from '$lib/engines/2d-annotate/edit';
	import {
		MARKER_TOOLS,
		MIN_SHAPE_PX,
		DEFAULT_COLOR,
		type Annotation,
		type AnnotationType
	} from '$lib/engines/2d-annotate/types';
	import {
		renameMarker,
		resequence,
		clearLabel,
		findDuplicates
	} from '$lib/engines/map-export/relabel';
	import {
		MAP_TYPES,
		reNumberMarkers,
		hallwayColor,
		labelSort,
		nearestVertex,
		nearestMidpoint,
		insertMidpoint,
		deleteVertex,
		centroid,
		type MapMarker,
		type MapMarkerType
	} from '$lib/engines/map-export/markers';
	import { normalizeCrop, type Crop } from '$lib/engines/map-export/layout';
	import { buildMapPdf, exportFilename, type PrintStyle } from '$lib/engines/map-export/export-pdf';
	import { buildAnnotatedPdf, EXPORT_SCALE } from '$lib/engines/2d-annotate/export-annotated';
	import CommentsPanel from '$lib/components/CommentsPanel.svelte';
	import { buildMapTextAlternative } from '$lib/engines/a11y/map-text';
	import { activeBrand } from '$lib/brand';
	import { toasts } from '$lib/stores/toasts.svelte';

	let { data }: { data: PageData } = $props();

	type Tool = 'select' | 'pan' | AnnotationType;
	const TOOLS: { id: Tool; key: string; label: string }[] = [
		{ id: 'select', key: 's', label: 'Select' },
		{ id: 'pan', key: 'p', label: 'Pan' },
		{ id: 'circle', key: 'c', label: 'Circle' },
		{ id: 'rect', key: 'r', label: 'Rect' },
		{ id: 'arrow', key: 'a', label: 'Arrow' },
		{ id: 'freehand', key: 'f', label: 'Draw' },
		{ id: 'comment', key: 't', label: 'Comment' },
		{ id: 'correction', key: 'x', label: 'Correction' },
		{ id: 'aed', key: '1', label: 'AED' },
		{ id: 'stairs', key: '2', label: 'Stairs' },
		{ id: 'door', key: '3', label: 'Door' },
		{ id: 'overhead', key: '4', label: 'Overhead' },
		{ id: 'exit', key: '5', label: 'Exit' },
		{ id: 'fireext', key: '6', label: 'Fire Ext' }
	];

	// --- engine state --- (seeded from the server load in onMount; viewer owns it after)
	let annotations = $state<Annotation[]>([]);
	let tool = $state<Tool>('select');
	let color = $state(DEFAULT_COLOR);
	let currentPage = $state(1);
	let totalPages = $state(1);
	let scale = $state(1.5);
	let selectedId = $state<string | null>(null);
	let dirty = $state(false);
	let saving = $state(false);
	let demoMode = $state(false);
	let pdfPageWidth = 800;

	const history = newHistory();
	let pdfDoc: any = null;
	let pdfCanvas: HTMLCanvasElement;
	let annCanvas: HTMLCanvasElement;
	let mapCanvas: HTMLCanvasElement;
	let area: HTMLDivElement;

	// --- map layer (E6) ---
	const MAP_TOOLS: { id: 'select' | 'crop' | MapMarkerType; key: string; label: string }[] = [
		{ id: 'select', key: 'v', label: 'Select' },
		{ id: 'stairs', key: 's', label: 'Stairs' },
		{ id: 'hallway', key: 'h', label: 'Hallway' },
		{ id: 'door', key: 'd', label: 'Door' },
		{ id: 'elevator', key: 'e', label: 'Elevator' },
		{ id: 'room', key: 'o', label: 'Room' },
		{ id: 'crop', key: 'c', label: 'Crop' }
	];
	const PRINT_STYLES: PrintStyle[] = ['command', 'blueprint', 'field'];
	let mapMode = $state(false);
	let mapTool = $state<'select' | 'crop' | MapMarkerType>('stairs');
	let markers = $state<MapMarker[]>([]);
	let crops = $state<Record<number, Crop>>({});
	let hallwayPts = $state<Array<{ nx: number; ny: number }>>([]);
	let mapDirty = $state(false);
	let exporting = $state(false);
	let selectedMapId = $state<string | null>(null);
	let printStyle = $state<PrintStyle>('command');
	const mapHistory = newHistory();

	// drawing scratch (annotation layer)
	let drawing = false;
	let startX = 0;
	let startY = 0;
	let points: Array<[number, number]> = [];
	// select+drag (annotation layer)
	let draggingAnn = false;
	let dragLastNx = 0;
	let dragLastNy = 0;
	let dragMoved = false;
	// pan (both layers)
	let panning = false;
	let panStartX = 0;
	let panStartY = 0;
	let panScrollL = 0;
	let panScrollT = 0;
	let spaceHeld = $state(false);
	// map editing scratch
	let cropStart: { nx: number; ny: number } | null = null;
	let cropDrawing = false;
	let mapDragKind: 'marker' | 'vertex' | null = null;
	let mapDragVertex = -1;
	let mapDragLast = { nx: 0, ny: 0 };
	let mapMoved = false;
	// Pre-drag marker state, pushed to the undo stack on pointer-up only when the
	// drag actually moved something (mirrors v1's lazy _mapDragSnapshot).
	let mapDragSnapshot: MapMarker[] | null = null;
	// delete-confirm modal
	let confirmDeleteOpen = $state(false);
	// responder safety layer visibility (E5 AC-5.4.1)
	let showResponderLayer = $state(true);

	function deserialize(rows: typeof data.annotations): Annotation[] {
		return rows.map((r) => ({
			id: r.id,
			page: r.page_number,
			type: r.type as AnnotationType,
			nx: r.nx,
			ny: r.ny,
			nw: r.nw,
			nh: r.nh,
			points: r.points ? JSON.parse(r.points) : undefined,
			color: r.color,
			text: r.text ?? undefined,
			resolved: !!r.resolved
		}));
	}

	function deserializeMarkers(rows: typeof data.markers): MapMarker[] {
		return rows.map((r) => ({
			id: r.id,
			type: r.type as MapMarkerType,
			label: r.label,
			page: r.page,
			nx: r.nx,
			ny: r.ny,
			labelPinned: !!r.label_pinned,
			labelNx: r.label_nx,
			labelNy: r.label_ny,
			points: r.points ? JSON.parse(r.points) : undefined,
			extraLabels: r.extra_labels ? JSON.parse(r.extra_labels) : undefined
		}));
	}

	const dims = () => ({ width: annCanvas.width, height: annCanvas.height });
	const nums = $derived(commentNumbers(annotations));
	// Non-visual map alternative (E12, WCAG): a text equivalent of this floor's
	// safety features for screen-reader users.
	const textAlt = $derived(buildMapTextAlternative(currentPage, annotations, markers));

	function redraw() {
		if (!annCanvas) return;
		// Responder layer = the 6 safety markers; toggling it off shows only the
		// non-responder annotations (AC-5.4.1).
		const visible = showResponderLayer
			? annotations
			: annotations.filter((a) => !MARKER_TOOLS.includes(a.type));
		renderAnnotations(annCanvas.getContext('2d')!, visible, currentPage, dims(), nums, selectedId);
		renderMap();
	}

	function renderMap() {
		if (!mapCanvas) return;
		const ctx = mapCanvas.getContext('2d')!;
		const cw = mapCanvas.width;
		const ch = mapCanvas.height;
		ctx.clearRect(0, 0, cw, ch);
		for (const m of markers) {
			if (m.page !== currentPage) continue;
			const color = m.type === 'hallway' ? hallwayColor(m.label) : MAP_TYPES[m.type].color;
			if (m.type === 'hallway' && m.points && m.points.length > 1) {
				ctx.save();
				ctx.strokeStyle = color;
				ctx.lineWidth = m.id === selectedMapId ? 4 : 2.5;
				ctx.beginPath();
				ctx.moveTo(m.points[0].nx * cw, m.points[0].ny * ch);
				for (const p of m.points) ctx.lineTo(p.nx * cw, p.ny * ch);
				ctx.stroke();
				ctx.restore();
			}
			drawMapChip(ctx, m.nx * cw, m.ny * ch, m.label, color, m.id === selectedMapId);
			// vertex + midpoint handles for the selected hallway (rich editing)
			if (m.id === selectedMapId && m.type === 'hallway' && m.points) {
				ctx.save();
				m.points.forEach((p) => {
					ctx.fillStyle = '#fff';
					ctx.strokeStyle = '#16A34A';
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.arc(p.nx * cw, p.ny * ch, 5, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();
				});
				// midpoints (hollow, for insert)
				for (let i = 0; i < m.points.length; i++) {
					const a = m.points[i];
					const b = m.points[(i + 1) % m.points.length];
					ctx.fillStyle = 'rgba(22,163,74,0.5)';
					ctx.beginPath();
					ctx.arc(((a.nx + b.nx) / 2) * cw, ((a.ny + b.ny) / 2) * ch, 3.5, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.restore();
			}
		}
		// crop for this page (dark strips + dashed rect)
		const crop = crops[currentPage];
		if (crop) drawCrop(ctx, crop, cw, ch);
		if (cropDrawing && cropStart) {
			drawCrop(ctx, { nx: cropStart.nx, ny: cropStart.ny, nw: cropPreview.nw, nh: cropPreview.nh }, cw, ch, true);
		}
		// in-progress hallway
		if (hallwayPts.length) {
			ctx.save();
			ctx.strokeStyle = '#16A34A';
			ctx.setLineDash([5, 4]);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(hallwayPts[0].nx * cw, hallwayPts[0].ny * ch);
			for (const p of hallwayPts) ctx.lineTo(p.nx * cw, p.ny * ch);
			ctx.stroke();
			ctx.restore();
		}
	}

	let cropPreview = { nw: 0, nh: 0 };

	function drawCrop(
		ctx: CanvasRenderingContext2D,
		crop: { nx: number; ny: number; nw: number; nh: number },
		cw: number,
		ch: number,
		preview = false
	) {
		const x = crop.nx * cw;
		const y = crop.ny * ch;
		const w = crop.nw * cw;
		const h = crop.nh * ch;
		ctx.save();
		if (!preview) {
			// dark strips outside the crop
			ctx.fillStyle = 'rgba(10,19,30,0.45)';
			ctx.fillRect(0, 0, cw, y);
			ctx.fillRect(0, y + h, cw, ch - (y + h));
			ctx.fillRect(0, y, x, h);
			ctx.fillRect(x + w, y, cw - (x + w), h);
		}
		ctx.strokeStyle = activeBrand.colors.primary; // brand token, not a literal
		ctx.setLineDash([6, 4]);
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, w, h);
		ctx.restore();
	}

	function drawMapChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, sel: boolean) {
		ctx.save();
		ctx.fillStyle = color;
		ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.3)';
		ctx.lineWidth = sel ? 2.5 : 1;
		const r = 11;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#fff';
		ctx.font = '700 10px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	async function renderPage(n: number) {
		if (demoMode) {
			drawDemo();
			redraw();
			return;
		}
		const page = await pdfDoc.getPage(n);
		const viewport = page.getViewport({ scale });
		for (const c of [pdfCanvas, annCanvas, mapCanvas]) {
			c.width = viewport.width;
			c.height = viewport.height;
		}
		await page.render({ canvasContext: pdfCanvas.getContext('2d')!, viewport }).promise;
		redraw();
	}

	function drawDemo() {
		const w = Math.max((area?.clientWidth ?? 900) - 40, 320);
		const h = Math.round(w * 0.72);
		for (const c of [pdfCanvas, annCanvas, mapCanvas]) {
			c.width = w;
			c.height = h;
		}
		const ctx = pdfCanvas.getContext('2d')!;
		ctx.fillStyle = '#f7f7f5';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#94a3b8';
		ctx.lineWidth = 2;
		ctx.strokeRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);
		ctx.beginPath();
		ctx.moveTo(w * 0.5, h * 0.1);
		ctx.lineTo(w * 0.5, h * 0.9);
		ctx.moveTo(w * 0.08, h * 0.5);
		ctx.lineTo(w * 0.92, h * 0.5);
		ctx.stroke();
		ctx.fillStyle = '#64748b';
		ctx.font = '14px system-ui';
		ctx.fillText('Demo floorplan - object storage not configured (E7/S4)', w * 0.1, h * 0.06);
	}

	function deserializeCrops(rows: typeof data.crops): Record<number, Crop> {
		const out: Record<number, Crop> = {};
		for (const c of rows)
			out[c.page] = { nx: c.nx, ny: c.ny, nw: c.nw, nh: c.nh, label: c.label ?? undefined, printOrder: c.print_order };
		return out;
	}

	onMount(async () => {
		annotations = deserialize(data.annotations);
		markers = reNumberMarkers(deserializeMarkers(data.markers));
		crops = deserializeCrops(data.crops);
		try {
			const pdfjs = await import('pdfjs-dist');
			pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
			const res = await fetch(data.fileUrl);
			if (!res.ok) throw new Error('no file');
			const buf = await res.arrayBuffer();
			// isEvalSupported:false neutralises CVE-2024-4367 in the pinned 3.11.x.
			pdfDoc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
			totalPages = pdfDoc.numPages;
			const p1 = await pdfDoc.getPage(1);
			pdfPageWidth = p1.getViewport({ scale: 1 }).width;
			scale = clampScale(calcFitScale(area.clientWidth, pdfPageWidth));
			await renderPage(1);
		} catch {
			demoMode = true;
			totalPages = 1;
			await renderPage(1);
		}
		// Refit the map whenever the canvas area changes size (window resize,
		// panel show/hide, orientation). Auto-fit yields once the user zooms.
		ro = new ResizeObserver(() => {
			if (!autoFit) return;
			if (resizeRaf) cancelAnimationFrame(resizeRaf);
			resizeRaf = requestAnimationFrame(fitToWidth);
		});
		if (area) ro.observe(area);
	});

	onDestroy(() => {
		ro?.disconnect();
		if (resizeRaf) cancelAnimationFrame(resizeRaf);
	});

	let ro: ResizeObserver | undefined;
	let resizeRaf = 0;
	let autoFit = true; // fit-to-width until the user manually zooms

	function fitToWidth() {
		if (!area || pdfPageWidth <= 0) return;
		const next = clampScale(calcFitScale(area.clientWidth, pdfPageWidth));
		if (Math.abs(next - scale) < 0.01) return; // avoid needless re-render
		scale = next;
		renderPage(currentPage);
	}

	function commit(a: Annotation) {
		pushUndo(history, annotations);
		annotations = [...annotations, a];
		selectedId = a.id;
		dirty = true;
		redraw();
	}

	function newId() {
		return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	function startPan(e: PointerEvent) {
		panning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panScrollL = area.scrollLeft;
		panScrollT = area.scrollTop;
	}

	function onPointerDown(e: PointerEvent) {
		// Capture the pointer so move/up still fire if the cursor leaves the
		// canvas mid-gesture (otherwise a drag/draw/pan gets stuck).
		try {
			(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		} catch {
			/* not all pointer types support capture */
		}
		// Pan: pan tool, held space, or middle mouse - works regardless of edit rights.
		if (tool === 'pan' || spaceHeld || e.button === 1) {
			startPan(e);
			return;
		}
		if (!data.canEdit) return;
		const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
		startX = p.x;
		startY = p.y;
		if (tool === 'select') {
			selectedId = hitTest(annotations, p.x, p.y, dims());
			if (selectedId) {
				// begin a potential drag-move; snapshot is pushed on first real move
				draggingAnn = true;
				dragMoved = false;
				const n = toNorm(p.x, p.y, 0, 0, dims());
				dragLastNx = n.nx;
				dragLastNy = n.ny;
			}
			redraw();
			return;
		}
		const n = toNorm(p.x, p.y, 0, 0, dims());
		if (tool === 'comment') {
			const text = window.prompt('Comment text:') ?? '';
			if (text.trim())
				commit({ id: newId(), page: currentPage, type: 'comment', nx: n.nx, ny: n.ny, nw: 0, nh: 0, color, text, createdAt: new Date().toISOString() });
			return;
		}
		if (MARKER_TOOLS.includes(tool as AnnotationType)) {
			commit({ id: newId(), page: currentPage, type: tool as AnnotationType, nx: n.nx, ny: n.ny, nw: 0, nh: 0, color });
			return;
		}
		drawing = true;
		points = tool === 'freehand' ? [[n.nx, n.ny]] : [];
	}

	function onPointerMove(e: PointerEvent) {
		if (panning) {
			area.scrollLeft = panScrollL - (e.clientX - panStartX);
			area.scrollTop = panScrollT - (e.clientY - panStartY);
			return;
		}
		if (draggingAnn && selectedId) {
			const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
			const n = toNorm(p.x, p.y, 0, 0, dims());
			const dnx = n.nx - dragLastNx;
			const dny = n.ny - dragLastNy;
			if (!dragMoved && (Math.abs(dnx) > 0.001 || Math.abs(dny) > 0.001)) {
				pushUndo(history, annotations); // snapshot once, on the first real move
				dragMoved = true;
			}
			if (dragMoved) {
				annotations = annotations.map((a) =>
					a.id === selectedId ? clampAnnotation(translateAnnotation(a, dnx, dny)) : a
				);
				dragLastNx = n.nx;
				dragLastNy = n.ny;
				dirty = true;
				redraw();
			}
			return;
		}
		if (!drawing) return;
		const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
		const ctx = annCanvas.getContext('2d')!;
		redraw();
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		if (tool === 'freehand') {
			const n = toNorm(p.x, p.y, 0, 0, dims());
			points.push([n.nx, n.ny]);
			ctx.beginPath();
			ctx.moveTo(points[0][0] * annCanvas.width, points[0][1] * annCanvas.height);
			for (const pt of points) ctx.lineTo(pt[0] * annCanvas.width, pt[1] * annCanvas.height);
			ctx.stroke();
		} else {
			ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
		}
		ctx.restore();
	}

	function onPointerUp(e: PointerEvent) {
		if (panning) {
			panning = false;
			return;
		}
		if (draggingAnn) {
			draggingAnn = false;
			return;
		}
		if (!drawing) return;
		drawing = false;
		const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
		if (tool === 'freehand') {
			if (points.length >= 3)
				commit({ id: newId(), page: currentPage, type: 'freehand', nx: 0, ny: 0, nw: 0, nh: 0, points: [...points], color });
			redraw();
			return;
		}
		const dx = p.x - startX;
		const dy = p.y - startY;
		if (Math.abs(dx) < MIN_SHAPE_PX && Math.abs(dy) < MIN_SHAPE_PX) {
			redraw();
			return;
		}
		const n = toNorm(startX, startY, dx, dy, dims());
		commit({ id: newId(), page: currentPage, type: tool as AnnotationType, nx: n.nx, ny: n.ny, nw: n.nw, nh: n.nh, color });
	}

	function undo() {
		const prev = doUndo(history, annotations);
		if (prev) {
			annotations = prev;
			selectedId = null;
			dirty = true;
			redraw();
		}
	}
	function redo() {
		const next = doRedo(history, annotations);
		if (next) {
			annotations = next;
			dirty = true;
			redraw();
		}
	}
	function requestDelete() {
		if (mapMode ? selectedMapId : selectedId) confirmDeleteOpen = true;
	}
	function confirmDelete() {
		confirmDeleteOpen = false;
		if (mapMode) {
			deleteMarker();
			return;
		}
		if (!selectedId) return;
		pushUndo(history, annotations);
		annotations = annotations.filter((a) => a.id !== selectedId);
		selectedId = null;
		dirty = true;
		redraw();
	}

	// Map-layer undo/redo (separate stack from annotations).
	function pushMapUndo() {
		pushUndo(mapHistory, markers);
	}
	function undoMap() {
		const prev = doUndo(mapHistory, markers);
		if (prev) {
			markers = reNumberMarkers(prev);
			selectedMapId = null;
			mapDirty = true;
			renderMap();
		}
	}
	function redoMap() {
		const next = doRedo(mapHistory, markers);
		if (next) {
			markers = reNumberMarkers(next);
			mapDirty = true;
			renderMap();
		}
	}

	async function save() {
		saving = true;
		const payload = annotations.map((a) => ({
			id: a.id,
			page: a.page,
			type: a.type,
			nx: a.nx,
			ny: a.ny,
			nw: a.nw,
			nh: a.nh,
			points: a.points,
			color: a.color,
			text: a.text,
			resolved: a.resolved
		}));
		const res = await fetch(`/api/documents/${data.document.id}/annotations`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ annotations: payload })
		});
		saving = false;
		if (res.ok) {
			dirty = false;
			toasts.success('Annotations saved.');
		} else {
			toasts.error('Could not save annotations. Your changes are still here - try again.');
		}
	}

	function exportJson() {
		const env = buildExport(data.document.id, data.document.filename, annotations, new Date().toISOString());
		const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = data.document.filename.replace(/\.[^.]+$/, '') + '_annotations.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	// --- map layer interaction (E6) ---
	function mapId() {
		return 'mk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	const selectedMarker = () => markers.find((m) => m.id === selectedMapId) ?? null;

	function onMapPointerDown(e: PointerEvent) {
		try {
			(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		} catch {
			/* not all pointer types support capture */
		}
		if (tool === 'pan' || spaceHeld || e.button === 1) {
			startPan(e);
			return;
		}
		if (!data.canEdit) return;
		const p = screenToCanvas(e.clientX, e.clientY, mapCanvas.getBoundingClientRect(), dims());
		const nx = p.x / mapCanvas.width;
		const ny = p.y / mapCanvas.height;
		mapMoved = false;

		if (mapTool === 'crop') {
			cropStart = { nx, ny };
			cropDrawing = true;
			cropPreview = { nw: 0, nh: 0 };
			return;
		}
		if (mapTool === 'select') {
			// rich hallway editing: vertex drag / midpoint insert on the selected polygon
			const sel = selectedMarker();
			if (sel && sel.type === 'hallway' && sel.points) {
				const vi = nearestVertex(sel.points, nx, ny);
				if (vi >= 0) {
					pushMapUndo();
					mapDragKind = 'vertex';
					mapDragVertex = vi;
					return;
				}
				const mi = nearestMidpoint(sel.points, nx, ny);
				if (mi >= 0) {
					pushMapUndo();
					updateSelected((m) => ({ ...m, points: insertMidpoint(m.points!, mi) }));
					mapDragKind = 'vertex';
					mapDragVertex = mi + 1;
					mapDirty = true;
					renderMap();
					return;
				}
			}
			const hit = nearestMarker(nx, ny);
			// In resequence mode a click claims the next number instead of selecting.
			if (hit && resequenceType) {
				pickForResequence(hit);
				return;
			}
			selectedMapId = hit;
			if (hit) {
				// Snapshot rather than push: a plain select must not burn an undo
				// slot, or fifty stray clicks silently flush the whole history.
				// The snapshot is committed in onMapPointerUp only if it moved.
				mapDragSnapshot = markers.map((m) => ({ ...m }));
				mapDragKind = 'marker';
				mapDragLast = { nx, ny };
			}
			renderMap();
			return;
		}
		if (mapTool === 'hallway') {
			hallwayPts = [...hallwayPts, { nx, ny }];
			renderMap();
			return;
		}
		// point marker placement
		pushMapUndo();
		markers = reNumberMarkers([
			...markers,
			{ id: mapId(), type: mapTool, label: '', page: currentPage, nx, ny, createdAt: new Date().toISOString() }
		]);
		mapDirty = true;
		renderMap();
	}

	function updateSelected(fn: (m: MapMarker) => MapMarker) {
		markers = markers.map((m) => (m.id === selectedMapId ? fn(m) : m));
	}

	function onMapPointerMove(e: PointerEvent) {
		if (panning) {
			area.scrollLeft = panScrollL - (e.clientX - panStartX);
			area.scrollTop = panScrollT - (e.clientY - panStartY);
			return;
		}
		const p = screenToCanvas(e.clientX, e.clientY, mapCanvas.getBoundingClientRect(), dims());
		const nx = p.x / mapCanvas.width;
		const ny = p.y / mapCanvas.height;
		if (cropDrawing && cropStart) {
			cropPreview = { nw: nx - cropStart.nx, nh: ny - cropStart.ny };
			renderMap();
			return;
		}
		if (mapDragKind === 'marker' && selectedMapId) {
			const dnx = nx - mapDragLast.nx;
			const dny = ny - mapDragLast.ny;
			mapDragLast = { nx, ny };
			mapMoved = true;
			updateSelected((m) => {
				if (m.type === 'hallway' && m.points) {
					const pts = m.points.map((pt) => ({ nx: pt.nx + dnx, ny: pt.ny + dny }));
					const c = centroid(pts);
					return { ...m, points: pts, nx: c.nx, ny: c.ny };
				}
				return { ...m, nx: m.nx + dnx, ny: m.ny + dny };
			});
			mapDirty = true;
			renderMap();
			return;
		}
		if (mapDragKind === 'vertex' && selectedMapId) {
			mapMoved = true;
			updateSelected((m) => {
				if (!m.points) return m;
				const pts = m.points.map((pt, i) => (i === mapDragVertex ? { nx, ny } : pt));
				const c = centroid(pts);
				return { ...m, points: pts, nx: c.nx, ny: c.ny };
			});
			mapDirty = true;
			renderMap();
		}
	}

	function onMapPointerUp() {
		if (panning) {
			panning = false;
			return;
		}
		if (cropDrawing && cropStart) {
			cropDrawing = false;
			const norm = normalizeCrop(cropStart.nx, cropStart.ny, cropPreview.nw, cropPreview.nh);
			cropStart = null;
			if (norm) {
				const existing = crops[currentPage];
				crops = { ...crops, [currentPage]: { ...norm, label: existing?.label, printOrder: existing?.printOrder ?? currentPage } };
				saveCropRemote(currentPage);
			}
			renderMap();
			return;
		}
		// Commit the pre-drag snapshot only if the drag actually moved something,
		// so selecting a marker costs nothing from the undo history.
		if (mapDragSnapshot && mapMoved) pushUndo(mapHistory, mapDragSnapshot);
		mapDragSnapshot = null;
		mapMoved = false;
		mapDragKind = null;
		mapDragVertex = -1;
	}

	function onMapDblClick(e: MouseEvent) {
		if (!data.canEdit || mapTool !== 'select') return;
		const p = screenToCanvas(e.clientX, e.clientY, mapCanvas.getBoundingClientRect(), dims());
		const nx = p.x / mapCanvas.width;
		const ny = p.y / mapCanvas.height;
		const sel = selectedMarker();
		// delete a hallway vertex on dbl-click
		if (sel && sel.type === 'hallway' && sel.points) {
			const vi = nearestVertex(sel.points, nx, ny);
			if (vi >= 0) {
				pushMapUndo();
				updateSelected((m) => ({ ...m, points: deleteVertex(m.points!, vi) }));
				updateSelected((m) => ({ ...m, ...centroid(m.points!) }));
				mapDirty = true;
				renderMap();
				return;
			}
		}
		// otherwise edit the label of the marker under the cursor
		const hit = nearestMarker(nx, ny);
		if (hit) {
			selectedMapId = hit;
			openRename(hit);
		}
	}

	// --- Relabeling (Epic E15) -------------------------------------------------
	// Renaming swaps with whoever already holds the target label, so a duplicate
	// cannot be produced from the UI, and an empty input clears back to
	// auto-numbering. Replaces a window.prompt that had no validation at all.
	let renameId = $state<string | null>(null);
	let renameValue = $state('');

	function openRename(id: string) {
		if (!data.canEdit) return;
		renameId = id;
		renameValue = markers.find((m) => m.id === id)?.label ?? '';
	}

	function commitRename() {
		if (!renameId) return;
		const id = renameId;
		const value = renameValue;
		renameId = null;
		pushMapUndo();
		const next = markers.map((m) => ({ ...m }));
		if (renameMarker(next, id, value)) {
			markers = next;
			mapDirty = true;
			renderMap();
		}
	}

	function cancelRename() {
		renameId = null;
	}

	// Resequence mode: pick a type, click markers in the order you want them
	// numbered. This is the primary way to renumber a route.
	let resequenceType = $state<MapMarkerType | null>(null);
	let resequencePicks = $state<string[]>([]);

	function startResequence(type: MapMarkerType) {
		resequenceType = type;
		resequencePicks = [];
		selectedMapId = null;
	}

	function pickForResequence(id: string): boolean {
		if (!resequenceType) return false;
		const m = markers.find((x) => x.id === id);
		if (!m || m.type !== resequenceType) return false;
		if (resequencePicks.includes(id)) return true; // already claimed its number
		resequencePicks = [...resequencePicks, id];
		renderMap();
		return true;
	}

	function commitResequence() {
		if (!resequenceType) return;
		const type = resequenceType;
		const picks = resequencePicks;
		resequenceType = null;
		resequencePicks = [];
		if (picks.length === 0) return;
		pushMapUndo();
		const next = markers.map((m) => ({ ...m }));
		resequence(next, type, picks);
		markers = next;
		mapDirty = true;
		renderMap();
		toasts.success(`Renumbered ${picks.length} ${MAP_TYPES[type].label.toLowerCase()} markers.`);
	}

	function cancelResequence() {
		resequenceType = null;
		resequencePicks = [];
		renderMap();
	}

	function clearMarkerLabel(id: string) {
		pushMapUndo();
		const next = markers.map((m) => ({ ...m }));
		clearLabel(next, id);
		markers = next;
		mapDirty = true;
		renderMap();
	}

	/** Markers grouped by type for the side panel, in legend order. */
	const markerPanel = $derived(
		(['stairs', 'hallway', 'door', 'elevator', 'room'] as MapMarkerType[])
			.map((type) => ({
				type,
				meta: MAP_TYPES[type],
				items: markers
					.filter((m) => m.type === type)
					.slice()
					.sort((a, b) => labelSort(a.label, b.label))
			}))
			.filter((g) => g.items.length > 0)
	);

	const duplicateIds = $derived(new Set(findDuplicates(markers).flatMap((d) => d.ids)));

	async function saveCropRemote(page: number) {
		const c = crops[page];
		if (!c) return;
		await fetch(`/api/documents/${data.document.id}/crops`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ page, nx: c.nx, ny: c.ny, nw: c.nw, nh: c.nh, label: c.label, printOrder: c.printOrder })
		});
	}

	function commitHallway() {
		if (hallwayPts.length < 3) return;
		pushMapUndo();
		const cx = hallwayPts.reduce((s, p) => s + p.nx, 0) / hallwayPts.length;
		const cy = hallwayPts.reduce((s, p) => s + p.ny, 0) / hallwayPts.length;
		markers = reNumberMarkers([
			...markers,
			{ id: mapId(), type: 'hallway', label: '', page: currentPage, nx: cx, ny: cy, points: [...hallwayPts], createdAt: new Date().toISOString() }
		]);
		hallwayPts = [];
		mapDirty = true;
		renderMap();
	}

	function nearestMarker(nx: number, ny: number): string | null {
		let best: string | null = null;
		let bestD = 0.03;
		for (const m of markers) {
			if (m.page !== currentPage) continue;
			const d = Math.hypot(m.nx - nx, m.ny - ny);
			if (d < bestD) {
				bestD = d;
				best = m.id;
			}
		}
		return best;
	}

	function deleteMarker() {
		if (!selectedMapId) return;
		pushMapUndo();
		markers = reNumberMarkers(markers.filter((m) => m.id !== selectedMapId));
		selectedMapId = null;
		mapDirty = true;
		renderMap();
	}

	async function saveMarkers() {
		saving = true;
		const payload = markers.map((m) => ({
			id: m.id,
			page: m.page,
			type: m.type,
			label: m.label,
			labelPinned: m.labelPinned,
			nx: m.nx,
			ny: m.ny,
			labelNx: m.labelNx,
			labelNy: m.labelNy,
			points: m.points,
			extraLabels: m.extraLabels
		}));
		const res = await fetch(`/api/documents/${data.document.id}/markers`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ markers: payload })
		});
		saving = false;
		if (res.ok) {
			mapDirty = false;
			toasts.success('Map markers saved.');
		} else {
			toasts.error('Could not save map markers. Try again.');
		}
	}

	// Autosave. Marker editing is dozens of small edits in a row, so an
	// explicit-save-only model loses work whenever someone navigates away. 800ms
	// matches v1's debounce. Driven by an effect on mapDirty rather than a call at
	// each of the ten mutation sites, so a new mutation site cannot forget to save.
	let mapSaveTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleMapSave() {
		if (mapSaveTimer) clearTimeout(mapSaveTimer);
		mapSaveTimer = setTimeout(() => {
			mapSaveTimer = null;
			if (!mapDirty) return;
			if (saving) return scheduleMapSave(); // retry behind the in-flight save
			saveMarkers();
		}, 800);
	}

	$effect(() => {
		if (mapDirty) scheduleMapSave();
	});

	// Last line of defence: an edit made inside the debounce window would otherwise
	// vanish on navigation. Covers annotations (dirty) and markers (mapDirty).
	function beforeUnload(e: BeforeUnloadEvent) {
		if (!mapDirty && !dirty) return;
		e.preventDefault();
		e.returnValue = '';
	}

	// Render any page to an offscreen canvas (PDF render or demo background) at a
	// given scale, returning the bare floorplan canvas. Shared by both exports.
	async function renderPageOffscreen(n: number, atScale: number): Promise<HTMLCanvasElement> {
		const c = document.createElement('canvas');
		if (demoMode || !pdfDoc) {
			c.width = Math.round(pdfCanvas.width || 1000);
			c.height = Math.round(pdfCanvas.height || 720);
			c.getContext('2d')!.drawImage(pdfCanvas, 0, 0, c.width, c.height);
			return c;
		}
		const page = await pdfDoc.getPage(n);
		const viewport = page.getViewport({ scale: atScale });
		c.width = viewport.width;
		c.height = viewport.height;
		await page.render({ canvasContext: c.getContext('2d')!, viewport }).promise;
		return c;
	}

	function pagesWithContent(): number[] {
		const set = new Set<number>([currentPage]);
		for (const m of markers) set.add(m.page);
		for (const p of Object.keys(crops)) set.add(Number(p));
		return [...set].sort((a, b) => a - b);
	}

	async function exportMapPdf() {
		exporting = true;
		try {
			const { default: JsPDF } = await import('jspdf');
			const pageNums = pagesWithContent();
			const pageInputs = [];
			for (const n of pageNums) {
				const canvas = await renderPageOffscreen(n, 2.0);
				pageInputs.push({
					page: n,
					imageDataUrl: canvas.toDataURL('image/jpeg', 0.95),
					canvasW: canvas.width,
					canvasH: canvas.height,
					markers: markers.filter((m) => m.page === n)
				});
			}
			const doc = buildMapPdf(
				(orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }),
				pageInputs,
				crops,
				markers,
				{
					facilityName: data.document.filename.replace(/\.[^.]+$/, ''),
					address: data.facilityAddress ?? undefined,
					zip: data.facilityZip ?? undefined,
					phone: data.facilityPhone ?? undefined,
					brandName: 'Pathfinder'
				},
				printStyle
			);
			doc.save(exportFilename(data.document.filename));
		} finally {
			exporting = false;
		}
	}

	// Annotated PDF export (E5): every page composited with its annotations.
	async function exportAnnotated() {
		exporting = true;
		try {
			const { default: JsPDF } = await import('jspdf');
			const pageNums = [];
			for (let i = 1; i <= totalPages; i++) pageNums.push(i);
			const pages = [];
			for (const n of pageNums) {
				const base = await renderPageOffscreen(n, EXPORT_SCALE);
				const composite = document.createElement('canvas');
				composite.width = base.width;
				composite.height = base.height;
				const cx = composite.getContext('2d')!;
				cx.drawImage(base, 0, 0);
				// draw this page's annotations on top via the engine renderer
				const dimsN = { width: composite.width, height: composite.height };
				for (const a of annotations) {
					if (a.page !== n) continue;
					drawAnnotation(cx, a, dimsN, { commentNum: nums.get(a.id) });
				}
				pages.push({ imageDataUrl: composite.toDataURL('image/jpeg', 0.9), wPx: composite.width, hPx: composite.height });
			}
			const doc = buildAnnotatedPdf((orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }), pages);
			doc.save(data.document.filename.replace(/\.[^.]+$/, '') + '_annotated.pdf');
		} finally {
			exporting = false;
		}
	}

	function toggleMapMode() {
		mapMode = !mapMode;
		selectedId = null;
		selectedMapId = null;
		hallwayPts = [];
		// Showing/hiding the comments panel changes the canvas width; let the
		// ResizeObserver refit (re-enable auto-fit so the map fills the new space).
		autoFit = true;
		redraw();
	}

	// AI responder briefing (Pro feature, grounded on this floor's markers).
	let briefing = $state('');
	let briefingBusy = $state(false);
	async function generateBriefing() {
		briefingBusy = true;
		briefing = '';
		try {
			const res = await fetch(`/api/documents/${data.document.id}/briefing`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ page: currentPage })
			});
			if (res.ok) {
				briefing = ((await res.json()) as { briefing: string }).briefing;
				toasts.success('Responder briefing generated.');
			} else {
				briefing = 'Briefing unavailable (no AI provider configured).';
				toasts.error('No AI provider is configured for this deployment.');
			}
		} catch {
			briefing = 'Briefing failed.';
			toasts.error('Briefing failed - network error.');
		} finally {
			briefingBusy = false;
		}
	}

	let shareUrl = $state('');
	async function makeShareLink() {
		const res = await fetch('/api/share', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ resourceType: 'document', resourceId: data.document.id })
		});
		if (res.ok) {
			shareUrl = ((await res.json()) as { url: string }).url;
			try {
				await navigator.clipboard.writeText(shareUrl);
				toasts.success('Read-only share link copied to clipboard.');
			} catch {
				toasts.info('Read-only share link created (copy it below).');
			}
		} else {
			toasts.error('Could not create a share link.');
		}
	}

	async function gotoPage(n: number) {
		if (n < 1 || n > totalPages) return;
		currentPage = n;
		await renderPage(n);
	}

	function onKey(e: KeyboardEvent) {
		// Escape closes the delete-confirm modal from anywhere (the backdrop is
		// never focused, so this is the reliable path).
		if (e.key === 'Escape' && confirmDeleteOpen) {
			confirmDeleteOpen = false;
			return;
		}
		const t = e.target as HTMLElement;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
		if (e.key === ' ' || e.code === 'Space') {
			spaceHeld = true;
			e.preventDefault(); // don't scroll the page while space-panning
			return;
		}
		if (mapMode) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				undoMap();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				redoMap();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
				e.preventDefault();
				saveMarkers();
				return;
			}
			if (e.key === 'Enter') {
				commitHallway();
				return;
			}
			if (e.key === 'Escape') {
				hallwayPts = [];
				toggleMapMode();
				return;
			}
			if (e.key === 'Delete' || e.key === 'Backspace') {
				requestDelete();
				return;
			}
			if (e.key === 'ArrowRight') gotoPage(currentPage + 1);
			if (e.key === 'ArrowLeft') gotoPage(currentPage - 1);
			const mt = MAP_TOOLS.find((m) => m.key === e.key.toLowerCase());
			if (mt) mapTool = mt.id;
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			undo();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			redo();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			save();
			return;
		}
		if (e.key === 'Delete' || e.key === 'Backspace') {
			requestDelete();
			return;
		}
		if (e.key === 'ArrowRight') gotoPage(currentPage + 1);
		if (e.key === 'ArrowLeft') gotoPage(currentPage - 1);
		const match = TOOLS.find((tl) => tl.key === e.key.toLowerCase());
		if (match) tool = match.id;
	}

	function onKeyUp(e: KeyboardEvent) {
		if (e.key === ' ' || e.code === 'Space') spaceHeld = false;
	}

	// Ctrl/Cmd + wheel zoom (v1), centred on the viewport.
	function onWheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey)) return;
		e.preventDefault();
		autoFit = false;
		scale = clampScale(scale + (e.deltaY < 0 ? 0.1 : -0.1));
		renderPage(currentPage);
	}

	function setZoom(delta: number) {
		autoFit = false; // manual zoom takes over from fit-to-width
		scale = clampScale(scale + delta);
		renderPage(currentPage);
	}

	function fitZoom() {
		autoFit = true;
		fitToWidth();
	}
</script>

<svelte:window onkeydown={onKey} onkeyup={onKeyUp} onbeforeunload={beforeUnload} />

<section class="viewer">
	<header class="vhead">
		<div>
			<p class="eyebrow">Floorplan</p>
			<h1>{data.document.filename}</h1>
		</div>
		<div class="actions">
			<!-- mode -->
			<div class="seg" role="group" aria-label="Editing mode">
				<button class:on={!mapMode} aria-pressed={!mapMode} onclick={() => mapMode && toggleMapMode()} data-testid="map-mode-toggle-annotate">Annotate</button>
				<button class:on={mapMode} aria-pressed={mapMode} onclick={() => !mapMode && toggleMapMode()} data-testid="map-mode-toggle">Map</button>
			</div>

			<!-- zoom -->
			<div class="zoomgrp" role="group" aria-label="Zoom">
				<button class="btn sm" onclick={() => setZoom(-0.25)} aria-label="Zoom out">&minus;</button>
				<button class="btn sm zoomval" onclick={fitZoom} aria-label="Fit to width" title="Fit to width" data-nums>{Math.round(scale * 100)}%</button>
				<button class="btn sm" onclick={() => setZoom(0.25)} aria-label="Zoom in">+</button>
			</div>

			{#if data.canEdit}
				<div class="grp" role="group" aria-label="History">
					<button class="btn sm" onclick={undo} data-testid="undo" aria-label="Undo">Undo</button>
					<button class="btn sm" onclick={redo} data-testid="redo" aria-label="Redo">Redo</button>
				</div>
				{#if !mapMode}
					<button class="btn primary" onclick={save} disabled={saving || !dirty} data-testid="save">
						{saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
					</button>
				{/if}
			{/if}

			<span class="vline"></span>

			<!-- export cluster -->
			<div class="grp" role="group" aria-label="Export">
				<button class="btn sm" onclick={exportJson} data-testid="export-json">JSON</button>
				<button class="btn sm" onclick={exportAnnotated} disabled={exporting} data-testid="export-annotated">Annotated PDF</button>
				{#if mapMode}
					<select class="stylesel" bind:value={printStyle} data-testid="print-style" aria-label="NFPA print style">
						{#each PRINT_STYLES as s (s)}<option value={s}>{s}</option>{/each}
					</select>
				{/if}
				<button class="btn sm" onclick={exportMapPdf} disabled={exporting} data-testid="export-map">
					{exporting ? 'Exporting...' : 'NFPA map'}
				</button>
			</div>

			{#if data.canEdit}
				<button class="btn sm" onclick={makeShareLink} data-testid="share-link">Share</button>
			{/if}
			{#if data.canEdit && data.aiEnabled}
				<button class="btn sm ai" onclick={generateBriefing} disabled={briefingBusy} data-testid="ai-briefing">
					{briefingBusy ? 'Briefing...' : 'AI briefing'}
				</button>
			{/if}

			<label class="layer-toggle" data-testid="responder-layer-toggle">
				<input type="checkbox" bind:checked={showResponderLayer} onchange={redraw} />
				Responder layer
			</label>
		</div>
	</header>
	{#if briefing}
		<p class="briefing" data-testid="briefing-text"><strong>Responder briefing:</strong> {briefing}</p>
	{/if}
	{#if shareUrl}
		<p class="share-note" data-testid="share-url">Read-only link copied: <code>{shareUrl}</code></p>
	{/if}

	<div class="workspace">
		{#if data.canEdit && !mapMode}
			<aside class="tools panel" data-testid="toolbar" aria-label="Annotation tools">
				<p class="tool-group">Draw</p>
				<div class="tool-grid">
					{#each TOOLS.filter((t) => !MARKER_TOOLS.includes(t.id as AnnotationType)) as tl (tl.id)}
						<button
							class="btn sm"
							class:active={tool === tl.id}
							onclick={() => (tool = tl.id)}
							data-testid={`tool-${tl.id}`}
							title={`${tl.label} (${tl.key})`}>{tl.label}</button
						>
					{/each}
				</div>
				<p class="tool-group">Safety markers</p>
				<div class="tool-grid">
					{#each TOOLS.filter((t) => MARKER_TOOLS.includes(t.id as AnnotationType)) as tl (tl.id)}
						<button
							class="btn sm"
							class:active={tool === tl.id}
							onclick={() => (tool = tl.id)}
							data-testid={`tool-${tl.id}`}
							title={`${tl.label} (${tl.key})`}>{tl.label}</button
						>
					{/each}
				</div>
				<label class="color">
					<span>Stroke colour</span>
					<input type="color" bind:value={color} aria-label="Annotation colour" />
				</label>
			</aside>
		{/if}
		{#if data.canEdit && mapMode}
			<aside class="tools panel" data-testid="map-toolbar" aria-label="Map marker tools">
				<p class="tool-group">Wayfinding</p>
				<div class="tool-grid">
					{#each MAP_TOOLS as mt (mt.id)}
						<button
							class="btn sm"
							class:active={mapTool === mt.id}
							onclick={() => (mapTool = mt.id)}
							data-testid={`map-tool-${mt.id}`}
							title={`${mt.label} (${mt.key})`}>{mt.label}</button
						>
					{/each}
				</div>
				{#if mapTool === 'hallway' && hallwayPts.length >= 3}
					<button class="btn sm" onclick={commitHallway} data-testid="close-hallway">Close polygon</button>
				{/if}
				<p class="tool-group">Renumber</p>
				{#if resequenceType}
					<div class="reseq" data-testid="resequence-active">
						<p class="reseq-hint">
							Click {MAP_TYPES[resequenceType].label.toLowerCase()} markers in the order you want them
							numbered. {resequencePicks.length} picked.
						</p>
						<div class="tool-grid">
							<button class="btn sm primary" onclick={commitResequence} data-testid="resequence-commit"
								>Apply</button
							>
							<button class="btn sm" onclick={cancelResequence} data-testid="resequence-cancel">Cancel</button>
						</div>
					</div>
				{:else}
					<div class="tool-grid">
						{#each markerPanel as g (g.type)}
							<button
								class="btn sm"
								onclick={() => startResequence(g.type)}
								data-testid={`resequence-${g.type}`}>{g.meta.label}s</button
							>
						{/each}
					</div>
				{/if}

				{#if markerPanel.length > 0}
					<p class="tool-group">Markers</p>
					<div class="marker-panel" data-testid="marker-panel">
						{#each markerPanel as g (g.type)}
							<p class="mp-type">{g.meta.label}s</p>
							{#each g.items as m (m.id)}
								<div class="mp-row" class:mp-sel={selectedMapId === m.id}>
									<button
										class="mp-chip"
										style={`background:${g.type === 'hallway' ? hallwayColor(m.label) : g.meta.color}`}
										onclick={() => {
											selectedMapId = m.id;
											renderMap();
										}}
										title="Select on the map">{m.label || '-'}</button
									>
									{#if duplicateIds.has(m.id)}
										<span class="mp-warn" title="Another marker of this type has the same label">dup</span>
									{/if}
									{#if m.labelFrozen}
										<span class="mp-flag" title="Frozen by an export">frozen</span>
									{:else if m.labelPinned}
										<span class="mp-flag" title="Manually set">pinned</span>
									{/if}
									{#if data.canEdit}
										<button class="mp-act" onclick={() => openRename(m.id)} title="Rename">Rename</button>
										{#if m.labelPinned || m.labelFrozen}
											<button
												class="mp-act"
												onclick={() => clearMarkerLabel(m.id)}
												title="Return to automatic numbering">Auto</button
											>
										{/if}
									{/if}
								</div>
							{/each}
						{/each}
					</div>
				{/if}

				<p class="tool-group">History</p>
				<div class="tool-grid">
					<button class="btn sm" onclick={undoMap} data-testid="map-undo">Undo</button>
					<button class="btn sm" onclick={redoMap} data-testid="map-redo">Redo</button>
				</div>
				<button
					class="btn primary"
					onclick={saveMarkers}
					disabled={saving || !mapDirty}
					data-testid="save-markers">{saving ? 'Saving...' : mapDirty ? 'Save map' : 'Saved'}</button
				>
			</aside>
		{/if}

		<div class="canvas-area" bind:this={area} data-testid="canvas-area" onwheel={onWheel}>
			<div class="canvas-stack">
				<canvas bind:this={pdfCanvas} class="pdf-layer"></canvas>
				<canvas
					bind:this={annCanvas}
					class="ann-layer"
					class:hidden-layer={mapMode}
					class:panning={tool === 'pan' || spaceHeld}
					data-testid="annotation-canvas"
					onpointerdown={onPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
				></canvas>
				<canvas
					bind:this={mapCanvas}
					class="ann-layer"
					class:hidden-layer={!mapMode}
					data-testid="map-canvas"
					onpointerdown={onMapPointerDown}
					onpointermove={onMapPointerMove}
					onpointerup={onMapPointerUp}
					ondblclick={onMapDblClick}
				></canvas>
			</div>
			<footer class="pager">
				<div class="pagergrp">
					<button class="btn sm" onclick={() => gotoPage(currentPage - 1)} disabled={currentPage <= 1}>Prev</button>
					<span class="pageind" data-testid="page-indicator" data-nums>Page {currentPage} / {totalPages}</span>
					<button class="btn sm" onclick={() => gotoPage(currentPage + 1)} disabled={currentPage >= totalPages}>Next</button>
				</div>
				<span class="count badge" data-testid="annotation-count">{annotations.length} annotations</span>
			</footer>

			<details class="text-alt" data-testid="text-alternative">
				<summary>Text alternative for this floor (screen reader)</summary>
				<div aria-live="polite">
					{#each textAlt as section (section.heading)}
						<h3>{section.heading}</h3>
						<ul>
							{#each section.items as item (item)}<li>{item}</li>{/each}
						</ul>
					{/each}
				</div>
			</details>
		</div>

		{#if !mapMode}
			<CommentsPanel documentId={data.document.id} {selectedId} canEdit={data.canEdit} />
		{/if}
	</div>

	{#if confirmDeleteOpen}
		<div
			class="modal-backdrop"
			role="presentation"
			onclick={() => (confirmDeleteOpen = false)}
			onkeydown={(e) => e.key === 'Escape' && (confirmDeleteOpen = false)}
		>
			<div
				class="modal"
				role="dialog"
				aria-modal="true"
				aria-label="Confirm delete"
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				<p>Delete the selected {mapMode ? 'marker' : 'annotation'}? This can be undone.</p>
				<div class="modal-actions">
					<button class="btn" onclick={() => (confirmDeleteOpen = false)} data-testid="delete-cancel">Cancel</button>
					<button class="btn danger" onclick={confirmDelete} data-testid="delete-confirm">Delete</button>
				</div>
			</div>
		</div>
	{/if}

	{#if renameId}
		<div
			class="modal-backdrop"
			role="presentation"
			onclick={cancelRename}
			onkeydown={(e) => e.key === 'Escape' && cancelRename()}
		>
			<div
				class="modal"
				role="dialog"
				aria-modal="true"
				aria-label="Rename marker"
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				<label class="rename-label" for="rename-input">Label</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="rename-input"
					class="rename-input"
					bind:value={renameValue}
					autofocus
					data-testid="rename-input"
					onkeydown={(e) => {
						if (e.key === 'Enter') commitRename();
						if (e.key === 'Escape') cancelRename();
					}}
				/>
				<p class="rename-hint">
					Taking a label another marker already has swaps the two. Leave it empty to return this
					marker to automatic numbering.
				</p>
				<div class="modal-actions">
					<button class="btn" onclick={cancelRename} data-testid="rename-cancel">Cancel</button>
					<button class="btn primary" onclick={commitRename} data-testid="rename-commit">Rename</button>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.viewer {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	/* command bar */
	.vhead {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: var(--space-2) var(--space-3);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-1);
		backdrop-filter: blur(10px);
	}
	.vhead h1 {
		font-size: 1.05rem;
		letter-spacing: -0.01em;
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.grp {
		display: inline-flex;
		gap: var(--space-1);
	}
	.vline {
		width: 1px;
		align-self: stretch;
		min-height: 1.5rem;
		background: color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		margin: 0 var(--space-1);
	}
	/* segmented mode control */
	.seg {
		display: inline-flex;
		padding: 3px;
		gap: 2px;
		background: color-mix(in srgb, var(--brand-bg) 55%, transparent);
		border: var(--line-strong);
		border-radius: var(--radius);
	}
	.seg button {
		padding: 0.3rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--brand-muted);
		font-size: 0.82rem;
		font-weight: 600;
		border-radius: 3px;
	}
	.seg button.on {
		background: var(--brand-primary);
		color: var(--brand-bg);
		box-shadow: var(--shadow-1);
	}
	/* zoom group pill */
	.zoomgrp {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.stylesel {
		width: auto;
		padding: 0.32rem 1.8rem 0.32rem 0.6rem;
		font-size: 0.8rem;
		text-transform: capitalize;
		background-position:
			calc(100% - 14px) 0.95em,
			calc(100% - 9px) 0.95em;
	}
	.ai {
		border-color: color-mix(in srgb, var(--brand-accent) 55%, transparent);
		color: var(--brand-accent);
	}
	.layer-toggle {
		font-size: 0.78rem;
		color: var(--brand-muted);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		white-space: nowrap;
	}
	.layer-toggle input {
		width: auto;
	}

	.briefing {
		background: color-mix(in srgb, var(--brand-accent) 9%, transparent);
		border: 1px solid color-mix(in srgb, var(--brand-accent) 35%, transparent);
		border-left: 3px solid var(--brand-accent);
		border-radius: var(--radius);
		padding: var(--space-3) var(--space-4);
		font-size: 0.92rem;
		line-height: 1.55;
	}
	.share-note {
		font-size: 0.85rem;
		color: var(--brand-muted);
	}
	.share-note code {
		color: var(--brand-primary);
		word-break: break-all;
	}

	/* workspace: tool rail + canvas + panel */
	.workspace {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 12rem;
		flex-shrink: 0;
		padding: var(--space-3);
		position: sticky;
		top: 5rem;
	}
	.tool-group {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-family: var(--brand-font-mono);
		color: var(--brand-muted);
		margin-top: var(--space-1);
	}
	.tool-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}
	.tool-grid .btn {
		padding: 0.45rem 0.4rem;
		font-size: 0.75rem;
		line-height: 1.2;
		/* labels like "Fire Ext"/"Correction" wrap instead of cramming/clipping */
		white-space: normal;
		overflow-wrap: anywhere;
		min-width: 0;
		min-height: 2.1rem;
	}
	.color {
		margin-top: var(--space-2);
		font-size: 0.7rem;
		color: var(--brand-muted);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.color input {
		width: 100%;
		height: 2rem;
		padding: 2px;
		cursor: pointer;
	}

	.canvas-area {
		flex: 1;
		min-width: 0;
		overflow: auto;
		background:
			linear-gradient(color-mix(in srgb, var(--brand-secondary) 12%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--brand-secondary) 12%, transparent) 1px, transparent 1px),
			var(--brand-bg);
		background-size: 24px 24px;
		border: var(--line);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		box-shadow: inset 0 0 60px -20px rgba(0, 0, 0, 0.6);
		/* Fill the viewport below the header + command bar so the map dominates.
		   Top-left flow (not centered) so a zoomed-in map scrolls correctly. */
		height: calc(100vh - 11rem);
		min-height: 30rem;
	}
	.zoomval {
		min-width: 3.4rem;
		font-family: var(--brand-font-mono);
		color: var(--brand-muted);
	}
	.canvas-stack {
		position: relative;
		display: inline-block;
	}
	.pdf-layer {
		display: block;
		border-radius: 2px;
		box-shadow: var(--shadow-3);
	}
	.ann-layer {
		position: absolute;
		inset: 0;
		touch-action: none;
		cursor: crosshair;
	}
	.hidden-layer {
		pointer-events: none;
	}
	.ann-layer.panning {
		cursor: grab;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--brand-bg) 55%, transparent);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		animation: pf-rise var(--dur-2) var(--ease-out) both;
	}
	.modal {
		background: var(--surface-glass);
		border: var(--line-strong);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		max-width: 22rem;
		box-shadow: var(--shadow-3);
		backdrop-filter: blur(16px);
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}

	.pager {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-3);
		color: var(--brand-muted);
	}
	.pagergrp {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.pageind {
		font-size: 0.82rem;
		font-family: var(--brand-font-mono);
		color: var(--brand-muted);
	}
	.pager .count {
		margin-left: auto;
	}

	.text-alt {
		margin-top: var(--space-3);
		font-size: 0.85rem;
		color: var(--brand-muted);
		border-top: var(--line);
		padding-top: var(--space-3);
	}
	.text-alt summary {
		cursor: pointer;
		color: var(--brand-text);
		font-weight: 600;
	}
	.text-alt h3 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--brand-primary);
		margin-top: var(--space-2);
	}
	.text-alt ul {
		margin: 0 0 var(--space-1) var(--space-3);
	}

	@media (max-width: 50rem) {
		.tools {
			position: static;
			width: 100%;
		}
		.workspace {
			flex-direction: column;
		}
		.vhead h1 {
			max-width: 100%;
		}
	}

	/* --- Relabeling: resequence mode, marker panel, rename (Epic E15) --- */
	.reseq {
		border: 1px solid color-mix(in srgb, var(--brand-primary) 45%, transparent);
		border-radius: 0.4rem;
		padding: 0.5rem;
		background: color-mix(in srgb, var(--brand-primary) 10%, transparent);
	}
	.reseq-hint {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		line-height: 1.35;
		color: var(--brand-text);
	}
	.marker-panel {
		max-height: 16rem;
		overflow-y: auto;
		border: 1px solid color-mix(in srgb, var(--brand-text) 14%, transparent);
		border-radius: 0.4rem;
		padding: 0.35rem;
	}
	.mp-type {
		margin: 0.4rem 0 0.2rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--brand-muted);
	}
	.mp-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.2rem;
		border-radius: 0.25rem;
	}
	.mp-sel {
		background: color-mix(in srgb, var(--brand-primary) 16%, transparent);
	}
	.mp-chip {
		min-width: 2.4rem;
		border: 0;
		border-radius: 0.25rem;
		padding: 0.1rem 0.35rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--brand-on-primary, #fff);
		cursor: pointer;
	}
	.mp-flag,
	.mp-warn {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--brand-muted);
	}
	.mp-warn {
		color: var(--brand-primary);
		font-weight: 700;
	}
	.mp-act {
		margin-left: auto;
		border: 0;
		background: none;
		padding: 0 0.2rem;
		font-size: 0.7rem;
		color: var(--brand-muted);
		cursor: pointer;
		text-decoration: underline;
	}
	.mp-act:hover {
		color: var(--brand-text);
	}
	.rename-label {
		display: block;
		font-size: 0.75rem;
		color: var(--brand-muted);
		margin-bottom: 0.25rem;
	}
	.rename-input {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border-radius: 0.3rem;
		border: 1px solid color-mix(in srgb, var(--brand-text) 25%, transparent);
		background: var(--brand-bg);
		color: var(--brand-text);
		font-size: 0.95rem;
	}
	.rename-hint {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--brand-muted);
	}
</style>
