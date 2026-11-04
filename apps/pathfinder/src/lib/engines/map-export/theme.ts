// Map engine - the theme document (design doc 2026-08-18, section 5).
//
// PRINCIPLE: layout is invariant, appearance is data. Before this module the
// exporter carried three hardcoded palettes and branched on a style key, so
// every colour, size and printed string was unreachable to an operator. Here
// each of those constants becomes a token, the three shipped looks become
// seeded rows (COMMAND / SAGE / ALERT) over ONE draw path, and a theme
// resolves through the org -> facility -> building -> floor cascade.
//
// Three tiers of customization (5.3):
//   1. pick a preset            -> PRESETS / themeForStyle
//   2. set the tokens you want  -> resolveTheme(partial) / mergeThemes(...)
//   3. reach anything at all    -> theme.overrides, keyed by dotted path
//
// Defaults derive from `src/lib/brand/` rather than literals wherever a brand
// token exists (5.4). Values with no brand equivalent are carried forward
// VERBATIM from v1 (`_runMapExport` PRINT_STYLES + the legend constants), so a
// default-theme export is byte-identical to the previous hardcoded one.
//
// Pure - no DOM, no jsPDF, no D1. Millimetres unless a name says otherwise.

import { HALLWAY_COLORS, MAP_TYPES, type MapMarkerType } from './markers';
import { els911 } from '../../brand/profiles/els911';

/** Legacy per-style key. Kept so existing callers and saved exports still work;
 *  each maps to a seeded preset (see PRESETS). */
export type PrintStyle = 'command' | 'blueprint' | 'field';

/** Pin / legend-chip shape family. v2 proved this is one parameter, not three
 *  code paths. `pill` and `circle` are new; `badge` is v1's rounded blob. */
export type MarkerShape = 'rect' | 'badge' | 'diamond' | 'pill' | 'circle';

/** Header band composition. v1's three header *compositions* stop being three
 *  code paths and become one enum (5.4). */
export type HeaderTreatment = 'solid' | 'graph-rule' | 'hazard-stripe' | 'none';

/** Corner anchor for the north arrow. */
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** A legend icon cell in mm (v1 _legCellSize). */
export interface LegendCell {
	w: number;
	h: number;
	hgap: number;
}

export interface MapThemeHeader {
	/** Band background. */
	bg: string;
	/** Facility name. */
	text: string;
	/** Address / phone line. */
	sub: string;
	/** Floor line and any tertiary header text. */
	tert: string;
	treatment: HeaderTreatment;
	/** Ink for `graph-rule` rules and `hazard-stripe` bars. */
	treatmentColor: string;
	/** Rule spacing / stripe spacing in mm. */
	treatmentPitchMm: number;
	/** Rule line width / stripe bar width in mm. */
	treatmentWidthMm: number;
	/** Band height. Page height follows it, so the plan does not move. */
	heightMm: number;
	/** Width reserved at the left for an operator logo (0 = no logo zone). */
	logoZoneMm: number;
	/** Accent rule along the band's bottom edge. */
	stripeMm: number;
	/** Optional small line above the facility name; unset = not printed. */
	eyebrow?: string;
	/** Baselines, measured from the top of the page. */
	eyebrowBaselineMm: number;
	titleBaselineMm: number;
	subBaselineMm: number;
	/** Separator between the address, zip and phone parts. */
	subSeparator: string;
	/** Right-hand line. Tokens: {name} {floor} {page} {pages}. */
	floorLineFormat: string;
}

export interface MapThemeLegend {
	bg: string;
	/** Type names and the LEGEND header. */
	text: string;
	/** Secondary legend ink. */
	sub: string;
	/** Counts caption. */
	muted: string;
	/** Row divider rule. */
	border: string;
	accent: string;
	/** Ink for the label inside a chip. */
	chipText: string;
	/** Width of the icon column the chips wrap inside (v1 LEG_ICON_W). */
	iconColWidthMm: number;
	/** Floor under every row height (v1 LEG_ROW_MIN_H). */
	rowMinHMm: number;
	/** The order types are listed in. A type absent here is not legended. */
	rowOrder: MapMarkerType[];
	headerText: string;
	/** Printed when a page has no mapped features. Empty = print nothing. */
	emptyText: string;
	/** Tokens: {count} {buildingCount}. */
	countFormat: string;
	/** Height of the LEGEND header strip (v1 LEG_HEADER_H). */
	headerHMm: number;
	/** Baseline of the LEGEND header inside that strip. */
	headerBaselineMm: number;
	/** Bottom padding of the whole legend block (v1 LEG_PAD_V). */
	padVMm: number;
	/** Vertical gap between wrapped chip rows (v1 LEG_CELL_VGAP). */
	cellVGapMm: number;
	/** Breathing room added to a row's chip block (v1 "+4mm"). */
	rowPadMm: number;
	/** Legend height when there is nothing to list. */
	emptyHMm: number;
	/** Icon column offset from the page padding. */
	iconOffsetMm: number;
	/** Gap between the icon column and the type name. */
	nameGapMm: number;
	/** Inset of the right-aligned count from the page padding. */
	countInsetMm: number;
	dividerWidthMm: number;
	/** Outline around a legend chip's container (v1 drew it in `chipText`). */
	chipBorderWidthMm: number;
	/** Stroke width of the icon inside a chip (door frame, staircase, chevrons). */
	chipArtWidthMm: number;
	/** Baseline nudges, because jsPDF text is baseline-anchored. */
	rowTextDyMm: number;
	chipTextDyMm: number;
	/** Per-type icon cell size (v1 _legCellSize, which varied by style). */
	cell: Record<MapMarkerType, LegendCell>;
}

export interface MapThemePlan {
	/** Frame around the floorplan raster. Width 0 = not drawn (v1 behaviour). */
	border: string;
	borderWidthMm: number;
	/** Rule between the plan and the legend. Width 0 = not drawn. */
	divider: string;
	dividerWidthMm: number;
	grid: { on: boolean; pitchMm: number; color: string; widthMm: number };
	north: {
		on: boolean;
		corner: Corner;
		color: string;
		/** Arrow height from tip to base. */
		sizeMm: number;
		/** Half-width of the arrow's base. */
		wingMm: number;
		insetXMm: number;
		insetYMm: number;
		label: string;
		labelDyMm: number;
	};
	/**
	 * Reserved for the scale bar (5.2). It can only be drawn where a plan scale
	 * is known, which needs the per-floor reference line that does not exist
	 * yet, so this is off and inert until that lands. The "not to scale" note in
	 * `footer.strapline` stands meanwhile.
	 */
	scaleBar: { on: boolean; color: string; lengthMm: number; heightMm: number };
	/** Ink for a marker's label. */
	pinLabel: string;
	/** Drop-shadow offset under a pin (v1: 0.4mm). 0 = no shadow. */
	pinShadowMm: number;
	pinShadow: string;
	/** Corner radius of a `rect` / `pill` pin. */
	pinRadiusMm: number;
	/** Baseline nudge for the label inside a pin. */
	pinLabelDyMm: number;
}

export interface MapThemeType {
	color: string;
	shape: MarkerShape;
	/** Pin diameter (v1 PIN_R was a 5mm radius). */
	sizeMm: number;
	labelPt: number;
	/** Name printed in the legend; pluralised there. */
	displayName: string;
	/** Auto-numbering prefix (S1, H2, E3 ...). */
	prefix: string;
	labelColor: string;
}

export interface MapThemeHallway {
	/** Colour cycle keyed by the label's number (v1 HALLWAY_COLORS). */
	palette: string[];
	fillOpacity: number;
	borderWidthMm: number;
	/** [dashMm, gapMm]; [0,0] = solid. */
	dash: [number, number];
	pillWMm: number;
	pillHMm: number;
}

export interface MapThemeFooter {
	/** Empty = no footer fill (v1 behaviour). */
	bg: string;
	text: string;
	/** Tokens: {brand} {facility} {date}. */
	strapline: string;
	/** Tokens: {page} {pages}. Empty = no page counter printed. */
	pageFormat: string;
	heightMm: number;
	/** Baseline measured up from the bottom of the page. */
	baselineMm: number;
}

export interface MapThemeOutput {
	renderScale: number;
	jpegQuality: number;
	imageFormat: 'JPEG' | 'PNG';
	/** Tokens: YYYY MM DD. */
	dateFormat: string;
	/** Tokens: {facility} {date}. Non-filename characters are slugified. */
	filenamePattern: string;
}

export interface MapTheme {
	id: string;
	name: string;
	/** Preset this theme was derived from, for "reset to preset". */
	basedOn?: string;
	header: MapThemeHeader;
	accent: string;
	/** Page padding, shared by header, legend and footer text columns (v1 PAD). */
	padMm: number;
	legend: MapThemeLegend;
	plan: MapThemePlan;
	types: Record<MapMarkerType, MapThemeType>;
	hallway: MapThemeHallway;
	typography: { family: string; sizes: Record<string, number> };
	footer: MapThemeFooter;
	output: MapThemeOutput;
	/** Tier 3 escape hatch: dotted path -> value, applied after everything else
	 *  so nothing in the pipeline stays unreachable. */
	overrides: Record<string, string | number>;
}

/** Every field optional, all the way down. Arrays are replaced, not merged. */
export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends ReadonlyArray<unknown>
		? T[K]
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

// --- defaults ---------------------------------------------------------------

// The print palette derives from the flagship operator profile: els911's
// primary IS the Command accent and its secondary IS the Command navy, so
// these are the same bytes v1 shipped, sourced from the brand layer instead of
// retyped as literals (closing the gap in audit 2.6).
const BRAND = els911;

const WHITE = '#FFFFFF';

/** v1 _legCellSize for the Command style, per type. */
const COMMAND_CELLS: Record<MapMarkerType, LegendCell> = {
	hallway: { w: 11.0, h: 6.5, hgap: 1.2 },
	room: { w: 16.0, h: 6.5, hgap: 1.5 },
	door: { w: 7.0, h: 10.0, hgap: 1.4 },
	stairs: { w: 11.5, h: 7.5, hgap: 1.6 },
	elevator: { w: 8.5, h: 8.5, hgap: 1.6 }
};

/** v1 _legCellSize for the Sage style (hallway/room are style-invariant). */
const SAGE_CELLS: Record<MapMarkerType, LegendCell> = {
	hallway: { w: 11.0, h: 6.5, hgap: 1.2 },
	room: { w: 16.0, h: 6.5, hgap: 1.5 },
	door: { w: 11.0, h: 15.0, hgap: 1.8 },
	stairs: { w: 18.0, h: 11.0, hgap: 2.0 },
	elevator: { w: 12.0, h: 14.0, hgap: 1.8 }
};

/** v1 _legCellSize for the Alert style. */
const ALERT_CELLS: Record<MapMarkerType, LegendCell> = {
	hallway: { w: 11.0, h: 6.5, hgap: 1.2 },
	room: { w: 16.0, h: 6.5, hgap: 1.5 },
	door: { w: 10.0, h: 15.0, hgap: 2.0 },
	stairs: { w: 16.0, h: 10.0, hgap: 2.0 },
	elevator: { w: 12.0, h: 12.0, hgap: 2.0 }
};

/** Per-type tokens seeded from the engine's MAP_TYPES registry. */
function typesFrom(shape: MarkerShape): Record<MapMarkerType, MapThemeType> {
	const out = {} as Record<MapMarkerType, MapThemeType>;
	for (const [key, meta] of Object.entries(MAP_TYPES) as Array<[MapMarkerType, typeof MAP_TYPES.stairs]>) {
		out[key] = {
			color: meta.color,
			shape,
			sizeMm: 10, // v1 PIN_R = 5mm radius
			labelPt: 7,
			displayName: meta.label,
			prefix: meta.prefix,
			labelColor: WHITE
		};
	}
	return out;
}

/**
 * The baseline every other theme is a delta of. Reproduces the Command look,
 * which is the default print style, so `resolveTheme({})` renders exactly what
 * the hardcoded exporter used to render.
 */
export const DEFAULT_THEME: MapTheme = {
	id: 'command',
	name: 'Command',
	header: {
		bg: BRAND.colors.secondary, // #002868 navy
		text: WHITE,
		sub: WHITE,
		tert: WHITE,
		treatment: 'solid',
		treatmentColor: WHITE,
		treatmentPitchMm: 5,
		treatmentWidthMm: 0.2,
		heightMm: 36, // v1 HDR_MM
		logoZoneMm: 0,
		stripeMm: 2.5,
		eyebrowBaselineMm: 6,
		titleBaselineMm: 13,
		subBaselineMm: 20,
		subSeparator: '   ',
		floorLineFormat: '{name}  -  {floor}'
	},
	accent: BRAND.colors.primary, // #B22234 red
	padMm: 10, // v1 PAD
	legend: {
		bg: '#F5F6F8',
		text: '#141E2D',
		/** v1 printed the empty-legend note (when it had one) in the body ink. */
		sub: '#141E2D',
		/** v1 drew the counts in the same ink as the type name; kept as its own
		 *  token so an operator can dim it without touching the name. */
		muted: '#141E2D',
		border: '#D2D6DC',
		accent: BRAND.colors.primary,
		chipText: WHITE,
		iconColWidthMm: 105, // v1 LEG_ICON_W
		rowMinHMm: 16, // v1 LEG_ROW_MIN_H
		rowOrder: ['stairs', 'hallway', 'door', 'elevator', 'room'],
		headerText: 'LEGEND',
		emptyText: '',
		countFormat: '{count} on floor  -  {buildingCount} total',
		headerHMm: 8, // v1 LEG_HEADER_H
		headerBaselineMm: 5.5,
		padVMm: 4, // v1 LEG_PAD_V
		cellVGapMm: 2.0, // v1 LEG_CELL_VGAP
		rowPadMm: 4,
		emptyHMm: 18,
		iconOffsetMm: 8,
		nameGapMm: 6,
		countInsetMm: 2,
		dividerWidthMm: 0.2,
		chipBorderWidthMm: 0.55, // v1 chip outline
		chipArtWidthMm: 0.5, // v1 door-frame / staircase / chevron stroke
		rowTextDyMm: 1,
		chipTextDyMm: 0.5,
		cell: COMMAND_CELLS
	},
	plan: {
		border: '#D2D6DC',
		borderWidthMm: 0,
		divider: '#D2D6DC',
		dividerWidthMm: 0,
		grid: { on: true, pitchMm: 25, color: '#C8CED6', widthMm: 0.1 },
		north: {
			on: true,
			corner: 'tr',
			color: '#141E2D',
			sizeMm: 5,
			wingMm: 3,
			insetXMm: 10,
			insetYMm: 12,
			label: 'N',
			labelDyMm: 7
		},
		scaleBar: { on: false, color: '#141E2D', lengthMm: 25, heightMm: 2 },
		pinLabel: WHITE,
		pinShadowMm: 0.4,
		pinShadow: '#000000',
		pinRadiusMm: 1,
		pinLabelDyMm: 0.6
	},
	types: typesFrom('rect'),
	// v1 drew a hallway as a translucent, dashed area with a label pill at its
	// centroid (viewer.js:3632-3705); these are its numbers.
	hallway: {
		palette: HALLWAY_COLORS,
		fillOpacity: 0.14,
		borderWidthMm: 0.9,
		dash: [3.5, 2],
		pillWMm: 10,
		pillHMm: 5.5
	},
	typography: {
		family: 'helvetica',
		sizes: {
			facility: 15,
			address: 8.5,
			eyebrow: 7,
			floorLine: 9,
			pinLabel: 7,
			legendHeader: 9,
			legendType: 9,
			legendCount: 7.5,
			legendChip: 6,
			north: 7,
			footer: 7
		}
	},
	footer: {
		bg: '',
		text: '#78828C',
		strapline: '{brand} - generated map - not to scale',
		pageFormat: '',
		heightMm: 8, // v1 FOOTER_H_MM
		baselineMm: 3
	},
	output: {
		renderScale: 2.0,
		jpegQuality: 0.92,
		imageFormat: 'JPEG',
		dateFormat: 'YYYY-MM-DD',
		filenamePattern: '{facility}_map.pdf'
	},
	overrides: {}
};

// --- merge ------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursive merge. Arrays and scalars are replaced; `undefined` is ignored so
 *  a partial can never blank a token by omission. */
function deepMerge<T>(base: T, patch: unknown): T {
	if (!isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
	const out: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };
	for (const [k, v] of Object.entries(patch)) {
		if (v === undefined) continue;
		if (Array.isArray(v)) out[k] = v.slice();
		else if (isPlainObject(v) && isPlainObject(out[k])) out[k] = deepMerge(out[k], v);
		else out[k] = v;
	}
	return out as T;
}

/** Set one dotted path ("legend.rowMinHMm") on a theme, in place. Unknown paths
 *  are ignored rather than creating stray keys. */
function setPath(target: Record<string, unknown>, path: string, value: string | number): void {
	const parts = path.split('.');
	let node: Record<string, unknown> = target;
	for (let i = 0; i < parts.length - 1; i++) {
		const next = node[parts[i]];
		if (!isPlainObject(next)) return;
		node = next;
	}
	const leaf = parts[parts.length - 1];
	if (!(leaf in node)) return;
	node[leaf] = value;
}

/** Apply `overrides` (tier 3) over the named tokens. Returns a new theme. */
function applyOverrides(theme: MapTheme): MapTheme {
	const entries = Object.entries(theme.overrides ?? {});
	if (entries.length === 0) return theme;
	const out = structuredCloneish(theme);
	for (const [path, value] of entries) setPath(out as unknown as Record<string, unknown>, path, value);
	return out;
}

/** Deep clone limited to the JSON-shaped data a theme holds. */
function structuredCloneish<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Resolve a partial theme against the default. This is the only way a theme
 * should be built for drawing: it guarantees every token is present, so the
 * exporter never needs a fallback at draw time.
 */
export function resolveTheme(partial: DeepPartial<MapTheme> = {}): MapTheme {
	return applyOverrides(deepMerge(structuredCloneish(DEFAULT_THEME), partial));
}

/**
 * The cascade (5.5): later layers win, so callers pass org -> facility ->
 * building -> floor -> this export, in that order, and the nearest scope wins.
 */
export function mergeThemes(base: MapTheme, ...layers: Array<DeepPartial<MapTheme> | undefined>): MapTheme {
	let out = structuredCloneish(base);
	for (const layer of layers) {
		if (layer) out = deepMerge(out, layer);
	}
	return applyOverrides(out);
}

// --- seeded presets ---------------------------------------------------------

/** Navy and red. v1 PRINT_STYLES.command, and the default. */
export const COMMAND: MapTheme = resolveTheme({ id: 'command', name: 'Command' });

/** Green and gold. v1 PRINT_STYLES.blueprint, shown to operators as "Sage". */
export const SAGE: MapTheme = resolveTheme({
	id: 'blueprint',
	name: 'Sage',
	basedOn: 'command',
	// v1 ruled the Sage band with 5mm horizontal hairlines (viewer.js:3543-3544).
	header: {
		bg: '#2F4F3F',
		treatment: 'graph-rule',
		treatmentColor: '#1C6E5B',
		treatmentPitchMm: 5,
		treatmentWidthMm: 0.2
	},
	accent: '#C9A227',
	legend: {
		text: '#1E2923',
		sub: '#1E2923',
		muted: '#1E2923',
		accent: '#C9A227',
		cell: SAGE_CELLS
	},
	types: typesFrom('badge')
});

/** Vermillion. v1 PRINT_STYLES.field, shown to operators as "Alert". */
export const ALERT: MapTheme = resolveTheme({
	id: 'field',
	name: 'Alert',
	basedOn: 'command',
	// v1 barred the Alert band with 45-degree hazard stripes (viewer.js:3587-3590).
	header: {
		bg: '#C85A14',
		treatment: 'hazard-stripe',
		treatmentColor: '#F07D23',
		treatmentPitchMm: 8,
		treatmentWidthMm: 2.5
	},
	accent: '#282828',
	legend: {
		text: '#281E14',
		sub: '#281E14',
		muted: '#281E14',
		accent: '#282828',
		cell: ALERT_CELLS
	},
	types: typesFrom('diamond')
});

/** The legacy style keys, so a saved `style: 'field'` still resolves. */
export const PRESETS: Record<PrintStyle, MapTheme> = {
	command: COMMAND,
	blueprint: SAGE,
	field: ALERT
};

/** Preset for a legacy style key; unknown keys fall back to the default. */
export function themeForStyle(style: PrintStyle | undefined): MapTheme {
	return (style && PRESETS[style]) || DEFAULT_THEME;
}

/** Anything a caller may pass where a theme is wanted: a legacy style key, a
 *  resolved theme, or a partial to resolve. */
export type ThemeLike = PrintStyle | MapTheme | DeepPartial<MapTheme> | undefined;

/** Normalise a ThemeLike into a complete theme. */
export function asTheme(t: ThemeLike): MapTheme {
	if (t === undefined) return DEFAULT_THEME;
	if (typeof t === 'string') return themeForStyle(t);
	// A complete theme is already resolved; anything else is merged over the
	// default. `overrides` is the cheapest sentinel for "fully resolved".
	if ('padMm' in t && 'legend' in t && (t as MapTheme).legend?.cell) return t as MapTheme;
	return resolveTheme(t);
}

/** Substitute {token} placeholders in a themed string. Unknown tokens are left
 *  alone so a typo is visible on the page rather than silently blank. */
export function fillTokens(pattern: string, values: Record<string, string | number>): string {
	return pattern.replace(/\{(\w+)\}/g, (whole, key: string) =>
		key in values ? String(values[key]) : whole
	);
}

/** Hallway colour for a label under a themed palette (v1 _hallwayColor, with
 *  the 8-colour cycle made a token). */
export function hallwayColorFor(label: string, palette: string[]): string {
	const colors = palette.length > 0 ? palette : HALLWAY_COLORS;
	const num = parseInt(label.replace(/\D/g, ''), 10);
	if (isNaN(num) || num < 1) return colors[0];
	return colors[(num - 1) % colors.length];
}

/** Format the current date under a theme's dateFormat token. */
export function formatDate(d: Date, format: string): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return format
		.replace('YYYY', String(d.getFullYear()))
		.replace('MM', pad(d.getMonth() + 1))
		.replace('DD', pad(d.getDate()));
}
