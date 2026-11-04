// Map engine - NFPA legend autofit (Epic E6).
//
// The load-bearing, fiddly correctness the canonical de-risking principle says
// not to re-litigate. Ported VERBATIM from v1 _runMapExport (_legCellSize,
// _layoutItem, legH_mm, chip placement). All units are millimetres. Pure - no
// DOM, no jsPDF. The browser-side exporter consumes these layouts and draws.
//
// The v1 constants and the per-style cell-size ladder now live in `theme.ts` as
// tokens (design doc section 5). The MATH here is unchanged: every function
// takes a theme where it used to take a style key, and a style key still works,
// so `layoutItem(item, 'command')` and `layoutItem(item, COMMAND)` agree.

import { labelSort, type MapMarker, type MapMarkerType } from './markers';
import { asTheme, DEFAULT_THEME, hallwayColorFor, type MapTheme, type ThemeLike } from './theme';

export type { PrintStyle } from './theme';

// Legend layout constants (v1). These are the DEFAULT theme's values, kept as
// named exports because the page-size math in layout.ts and the export skeleton
// read them; a theme overrides them per export without moving these defaults.
export const HDR_MM = DEFAULT_THEME.header.heightMm;
export const FOOTER_H_MM = DEFAULT_THEME.footer.heightMm;
export const PAD = DEFAULT_THEME.padMm;
export const LEG_HEADER_H = DEFAULT_THEME.legend.headerHMm;
export const LEG_PAD_V = DEFAULT_THEME.legend.padVMm;
export const LEG_ROW_MIN_H = DEFAULT_THEME.legend.rowMinHMm;
export const LEG_CELL_VGAP = DEFAULT_THEME.legend.cellVGapMm;
export const LEG_ICON_W = DEFAULT_THEME.legend.iconColWidthMm;

export interface LegendChip {
	label: string;
	color: string;
}

export interface LegendItem {
	type: MapMarkerType;
	typeName: string;
	count: number; // markers of this type on this page
	buildingCount: number; // markers of this type across the building
	chips: LegendChip[];
}

export interface CellSize {
	w: number;
	h: number;
	hgap: number;
}

export interface ItemLayout {
	cell: CellSize;
	perRow: number;
	rows: number;
	blockH: number;
	rowH: number;
}

/** Per-(theme,type) legend icon cell size in mm (v1 _legCellSize, now a token). */
export function legCellSize(type: MapMarkerType, theme?: ThemeLike): CellSize {
	const t = asTheme(theme);
	return t.legend.cell[type] ?? { w: 10.0, h: 10.0, hgap: 1.4 };
}

/** Wrap + row-height for one legend item (v1 _layoutItem). */
export function layoutItem(item: LegendItem, theme?: ThemeLike): ItemLayout {
	const t = asTheme(theme);
	const cell = legCellSize(item.type, t);
	const n = item.chips.length;
	const iconW = t.legend.iconColWidthMm;
	const maxPerRow = Math.max(1, Math.floor((iconW + cell.hgap) / (cell.w + cell.hgap)));
	const perRow = Math.min(n, maxPerRow);
	const rows = Math.ceil(n / perRow);
	const blockH = rows * cell.h + (rows - 1) * t.legend.cellVGapMm;
	const rowH = Math.max(t.legend.rowMinHMm, blockH + t.legend.rowPadMm); // breathing room
	return { cell, perRow, rows, blockH, rowH };
}

/** Total legend height in mm (v1 legH_mm). */
export function legendHeight(items: LegendItem[], theme?: ThemeLike): number {
	const t = asTheme(theme);
	if (items.length === 0) return t.legend.emptyHMm;
	const total = items.reduce((s, it) => s + layoutItem(it, t).rowH, 0);
	return t.legend.headerHMm + total + t.legend.padVMm;
}

/**
 * Build legend items from the markers on a page (v1 lines 3406-3427). One entry
 * per type that has markers on the page; each carries one chip per unique
 * label, sorted numeric-aware. Hallway chips get per-label colour from the
 * theme's palette; others share the type colour. `typeMeta` supplies
 * label/color per type (the exporter feeds it from the theme).
 */
export function buildLegendItems(
	pageMarkers: MapMarker[],
	buildingMarkers: MapMarker[],
	typeMeta: Record<MapMarkerType, { label: string; color: string }>,
	theme?: ThemeLike
): LegendItem[] {
	const t: MapTheme = asTheme(theme);
	const items: LegendItem[] = [];
	for (const type of t.legend.rowOrder) {
		const onPage = pageMarkers.filter((m) => m.type === type);
		if (onPage.length === 0) continue;
		const labels = [...new Set(onPage.map((m) => m.label))].sort(labelSort);
		items.push({
			type,
			typeName: typeMeta[type].label + 's',
			count: onPage.length,
			buildingCount: buildingMarkers.filter((m) => m.type === type).length,
			chips: labels.map((label) => ({
				label,
				color: type === 'hallway' ? hallwayColorFor(label, t.hallway.palette) : typeMeta[type].color
			}))
		});
	}
	return items;
}

/** One placed chip: top-left (cx,cy) and centre (x,y) in mm. */
export interface PlacedChip extends LegendChip {
	cx: number;
	cy: number;
	x: number;
	y: number;
}

/**
 * Place an item's chips within its icon column (v1 lines 4015-4028). Each
 * wrapped row is centred independently; the last (possibly short) row is
 * centred on its own count. `iconX` is the column left edge, `rowCY` the row's
 * vertical centre.
 */
export function placeChips(
	item: LegendItem,
	layout: ItemLayout,
	iconX: number,
	rowCY: number,
	theme?: ThemeLike
): PlacedChip[] {
	const t = asTheme(theme);
	const { cell, perRow, rows, blockH } = layout;
	const { chips } = item;
	const blockTopY = rowCY - blockH / 2;
	return chips.map((chip, ci) => {
		const cr = Math.floor(ci / perRow);
		const cc = ci % perRow;
		const inThisRow = cr === rows - 1 ? chips.length - cr * perRow : perRow;
		const rowStripW = inThisRow * cell.w + (inThisRow - 1) * cell.hgap;
		const startX = iconX + (t.legend.iconColWidthMm - rowStripW) / 2;
		const cx = startX + cc * (cell.w + cell.hgap);
		const cy = blockTopY + cr * (cell.h + t.legend.cellVGapMm);
		return { ...chip, cx, cy, x: cx + cell.w / 2, y: cy + cell.h / 2 };
	});
}
