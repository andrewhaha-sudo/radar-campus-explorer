// Map theme tokens + cascade (design doc 2026-08-18, sections 5.3-5.5).
//
// The contract under test: layout is invariant, appearance is data. Every
// colour, size and printed string in the PDF is a token; the three shipped
// looks are seeded rows over one draw path; and a theme resolves through
// org -> facility -> building -> floor with the nearest scope winning.

import { describe, it, expect } from 'vitest';
import {
	DEFAULT_THEME,
	COMMAND,
	SAGE,
	ALERT,
	PRESETS,
	resolveTheme,
	mergeThemes,
	themeForStyle,
	type DeepPartial,
	type MapTheme
} from '../../src/lib/engines/map-export/theme';
import { legendHeight, layoutItem, legCellSize, type LegendItem } from '../../src/lib/engines/map-export/legend';
import { buildMapPdf } from '../../src/lib/engines/map-export/export-pdf';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';
import { els911 } from '../../src/lib/brand/profiles/els911';
import { resolveThemeForBuilding } from '../../src/lib/server/themes';
import type { ScopeUser } from '../../src/lib/server/hierarchy';

describe('resolveTheme', () => {
	it('an empty partial resolves to the default theme', () => {
		expect(resolveTheme({})).toEqual(DEFAULT_THEME);
	});

	it('deep-merges a nested partial without dropping its siblings', () => {
		const t = resolveTheme({ legend: { iconColWidthMm: 80 } });
		expect(t.legend.iconColWidthMm).toBe(80);
		expect(t.legend.rowMinHMm).toBe(DEFAULT_THEME.legend.rowMinHMm);
		expect(t.legend.headerText).toBe(DEFAULT_THEME.legend.headerText);
	});

	it('a partial override changes only what it names', () => {
		const t = resolveTheme({ accent: '#123456' });
		expect(t.accent).toBe('#123456');
		// everything else is byte-identical to the default
		const { accent: _a, ...restT } = t;
		const { accent: _b, ...restD } = DEFAULT_THEME;
		expect(restT).toEqual(restD);
	});

	it('merges one type without disturbing the other types', () => {
		const t = resolveTheme({ types: { hallway: { color: '#000000' } } });
		expect(t.types.hallway.color).toBe('#000000');
		expect(t.types.hallway.prefix).toBe(DEFAULT_THEME.types.hallway.prefix);
		expect(t.types.stairs).toEqual(DEFAULT_THEME.types.stairs);
	});

	it('replaces array tokens wholesale rather than merging them element-wise', () => {
		const t = resolveTheme({ hallway: { palette: ['#111111', '#222222'] } });
		expect(t.hallway.palette).toEqual(['#111111', '#222222']);
	});

	it('does not mutate DEFAULT_THEME', () => {
		const before = JSON.stringify(DEFAULT_THEME);
		resolveTheme({ legend: { bg: '#000000' }, hallway: { palette: ['#fff'] } });
		expect(JSON.stringify(DEFAULT_THEME)).toBe(before);
	});

	it('applies tier-3 dotted-path overrides last, so they beat the named tokens', () => {
		const t = resolveTheme({
			legend: { rowMinHMm: 20 },
			overrides: { 'legend.rowMinHMm': 22, 'typography.sizes.footer': 5 }
		});
		expect(t.legend.rowMinHMm).toBe(22);
		expect(t.typography.sizes.footer).toBe(5);
	});
});

describe('seeded presets', () => {
	it('Command reproduces the navy/red look', () => {
		expect(COMMAND.header.bg).toBe('#002868');
		expect(COMMAND.accent).toBe('#B22234');
		expect(COMMAND.legend.text).toBe('#141E2D');
		expect(COMMAND.types.stairs.shape).toBe('rect');
		expect(COMMAND.name).toBe('Command');
	});

	it('Sage reproduces the green/gold look', () => {
		expect(SAGE.header.bg).toBe('#2F4F3F');
		expect(SAGE.accent).toBe('#C9A227');
		expect(SAGE.legend.text).toBe('#1E2923');
		expect(SAGE.types.stairs.shape).toBe('badge');
		expect(SAGE.name).toBe('Sage');
	});

	it('Alert reproduces the vermillion look', () => {
		expect(ALERT.header.bg).toBe('#C85A14');
		expect(ALERT.accent).toBe('#282828');
		expect(ALERT.legend.text).toBe('#281E14');
		expect(ALERT.types.stairs.shape).toBe('diamond');
		expect(ALERT.name).toBe('Alert');
	});

	it('the default theme is Command, so the default export is unchanged', () => {
		expect(DEFAULT_THEME.header.bg).toBe(COMMAND.header.bg);
		expect(DEFAULT_THEME.accent).toBe(COMMAND.accent);
	});

	it('default colours derive from the brand layer, not from literals', () => {
		expect(DEFAULT_THEME.accent).toBe(els911.colors.primary);
		expect(DEFAULT_THEME.header.bg).toBe(els911.colors.secondary);
	});

	it('maps the legacy PrintStyle keys onto the presets', () => {
		expect(themeForStyle('command')).toEqual(COMMAND);
		expect(themeForStyle('blueprint')).toEqual(SAGE);
		expect(themeForStyle('field')).toEqual(ALERT);
		expect(Object.keys(PRESETS).sort()).toEqual(['blueprint', 'command', 'field']);
	});

	it('every preset carries a full token set, so nothing falls back at draw time', () => {
		for (const preset of Object.values(PRESETS)) {
			for (const key of Object.keys(DEFAULT_THEME)) expect(preset).toHaveProperty(key);
			expect(Object.keys(preset.types).sort()).toEqual(Object.keys(DEFAULT_THEME.types).sort());
			expect(Object.keys(preset.legend.cell).sort()).toEqual(
				Object.keys(DEFAULT_THEME.legend.cell).sort()
			);
		}
	});
});

describe('mergeThemes cascade', () => {
	it('merges org -> facility -> building -> floor with the nearest scope winning', () => {
		const merged = mergeThemes(
			DEFAULT_THEME,
			{ accent: '#org000', legend: { headerText: 'ORG' }, footer: { strapline: 'district standard' } },
			{ accent: '#fac000', legend: { headerText: 'FACILITY' } },
			{ accent: '#bld000' },
			{ accent: '#flr000' }
		);
		expect(merged.accent).toBe('#flr000'); // floor is nearest
		expect(merged.legend.headerText).toBe('FACILITY'); // facility beats org
		expect(merged.footer.strapline).toBe('district standard'); // only org set it
		expect(merged.legend.rowMinHMm).toBe(DEFAULT_THEME.legend.rowMinHMm);
	});

	it('is order-sensitive: reversing the layers reverses the winner', () => {
		const a = mergeThemes(DEFAULT_THEME, { accent: '#aaaaaa' }, { accent: '#bbbbbb' });
		const b = mergeThemes(DEFAULT_THEME, { accent: '#bbbbbb' }, { accent: '#aaaaaa' });
		expect(a.accent).toBe('#bbbbbb');
		expect(b.accent).toBe('#aaaaaa');
	});
});

describe('legend layout is theme-driven and style-compatible', () => {
	const item: LegendItem = {
		type: 'door',
		typeName: 'Doors',
		count: 3,
		buildingCount: 3,
		chips: [
			{ label: 'A', color: '#000' },
			{ label: 'B', color: '#000' },
			{ label: 'C', color: '#000' }
		]
	};

	it('accepts a theme where it used to accept a style key, with the same result', () => {
		expect(legCellSize('door', COMMAND)).toEqual(legCellSize('door', 'command'));
		expect(legCellSize('stairs', ALERT)).toEqual(legCellSize('stairs', 'field'));
		expect(layoutItem(item, SAGE)).toEqual(layoutItem(item, 'blueprint'));
		expect(legendHeight([item], COMMAND)).toBe(legendHeight([item], 'command'));
	});

	it('honours a themed row minimum height', () => {
		const tall = resolveTheme({ legend: { rowMinHMm: 40 } });
		expect(layoutItem(item, tall).rowH).toBe(40);
		expect(legendHeight([], tall)).toBe(DEFAULT_THEME.legend.emptyHMm);
	});
});

// A recording jsPDF stand-in that separates geometry from colour, which is the
// whole claim of section 5.1: two themes must differ in colour alone.
function recordingDoc() {
	const geometry: string[] = [];
	const colors: string[] = [];
	const rec = (name: string) => (...args: unknown[]) => {
		const nums = args.filter((a) => typeof a === 'number' || typeof a === 'string');
		geometry.push(`${name}(${nums.join(',')})`);
		return doc;
	};
	const col = (name: string) => (...args: unknown[]) => {
		colors.push(`${name}(${args.join(',')})`);
		return doc;
	};
	const doc = {
		addPage: rec('addPage'),
		rect: rec('rect'),
		roundedRect: rec('roundedRect'),
		circle: rec('circle'),
		triangle: rec('triangle'),
		line: rec('line'),
		addImage: rec('addImage'),
		setFont: rec('setFont'),
		setFontSize: rec('setFontSize'),
		setLineWidth: rec('setLineWidth'),
		setLineDashPattern: rec('setLineDashPattern'),
		text: (t: unknown, x: unknown, y: unknown) => {
			geometry.push(`text(${String(t)},${x},${y})`);
			return doc;
		},
		setFillColor: col('setFillColor'),
		setTextColor: col('setTextColor'),
		setDrawColor: col('setDrawColor')
	};
	return { doc, geometry, colors };
}

const mk = (over: Partial<MapMarker> = {}): MapMarker => ({
	id: 'm1',
	type: 'stairs',
	label: 'S1',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

describe('themed export', () => {
	const pages = [
		{
			page: 1,
			imageDataUrl: 'data:image/jpeg;base64,AAA',
			canvasW: 1000,
			canvasH: 800,
			markers: [mk({}), mk({ id: 'm2', type: 'hallway', label: 'H1', nx: 0.2, ny: 0.3 })]
		}
	];

	function run(theme?: DeepPartial<MapTheme>) {
		const { doc, geometry, colors } = recordingDoc();
		buildMapPdf(
			() => doc as never,
			pages,
			{},
			pages[0].markers,
			{ facilityName: 'Rock L. Butler' },
			'command',
			theme
		);
		return { geometry, colors };
	}

	it('two themes over identical markers give identical geometry and different colours', () => {
		const a = run();
		const b = run({
			header: { bg: '#123456' },
			accent: '#654321',
			legend: { bg: '#ABCDEF', text: '#010203' }
		});
		expect(b.geometry).toEqual(a.geometry);
		expect(b.colors).not.toEqual(a.colors);
		expect(b.colors.length).toBe(a.colors.length);
	});

	it('a colour token reaches the page it names', () => {
		const { colors } = run({ header: { bg: '#123456' } });
		expect(colors[0]).toBe('setFillColor(18,52,86)');
	});

	it('a printed string is a token', () => {
		const { geometry } = run({ legend: { headerText: 'KEY' } });
		expect(geometry.some((g) => g.startsWith('text(KEY,'))).toBe(true);
		expect(geometry.some((g) => g.startsWith('text(LEGEND,'))).toBe(false);
	});

	it('turning the grid off removes its lines but not the page', () => {
		const on = run();
		const off = run({ plan: { grid: { on: false } } });
		expect(off.geometry.filter((g) => g.startsWith('line(')).length).toBeLessThan(
			on.geometry.filter((g) => g.startsWith('line(')).length
		);
		expect(off.geometry.filter((g) => g.startsWith('addImage(')).length).toBe(1);
	});
});

// --- server cascade ---------------------------------------------------------

const ADMIN: ScopeUser = { role: 'admin', org: null };
const OUTSIDER: ScopeUser = { role: 'client', org: 'Other District' };

/** Minimal D1 stand-in covering only the statements themes.ts issues. */
function fakeDB(opts: {
	orgName?: string;
	rows?: Array<{ scope_type: string; scope_id: string; tokens: string }>;
}) {
	const DB = {
		prepare(sql: string) {
			const s = sql.replace(/\s+/g, ' ').trim();
			const stmt = {
				_binds: [] as unknown[],
				bind(...args: unknown[]) {
					stmt._binds = args;
					return stmt;
				},
				async first<T>() {
					if (s.includes('o.name AS org_name')) {
						return (opts.orgName
							? { org_name: opts.orgName, org_id: 'org-1', facility_id: 'fac-1' }
							: null) as T | null;
					}
					throw new Error('fakeDB: unhandled first(): ' + s);
				},
				async all<T>() {
					if (s.includes('FROM map_themes')) return { results: (opts.rows ?? []) as T[] };
					throw new Error('fakeDB: unhandled all(): ' + s);
				}
			};
			return stmt;
		}
	};
	return { DB } as unknown as { DB: D1Database };
}

describe('resolveThemeForBuilding', () => {
	const rows = [
		{ scope_type: 'org', scope_id: 'org-1', tokens: JSON.stringify({ accent: '#org000', legend: { headerText: 'ORG' } }) },
		{ scope_type: 'facility', scope_id: 'fac-1', tokens: JSON.stringify({ accent: '#fac000' }) },
		{ scope_type: 'building', scope_id: 'bld-1', tokens: JSON.stringify({ accent: '#bld000' }) },
		{ scope_type: 'floor', scope_id: 'fl-1', tokens: JSON.stringify({ accent: '#flr000' }) }
	];

	it('merges org -> facility -> building -> floor, nearest wins', async () => {
		const env = fakeDB({ orgName: 'Wellsboro', rows });
		const theme = await resolveThemeForBuilding(ADMIN, 'bld-1', env, 'fl-1');
		expect(theme.accent).toBe('#flr000');
		expect(theme.legend.headerText).toBe('ORG'); // only the org set it
	});

	it('stops at the building when no floor theme applies', async () => {
		const env = fakeDB({ orgName: 'Wellsboro', rows: rows.slice(0, 3) });
		const theme = await resolveThemeForBuilding(ADMIN, 'bld-1', env);
		expect(theme.accent).toBe('#bld000');
	});

	it('falls back to the default theme when nothing is scoped', async () => {
		const env = fakeDB({ orgName: 'Wellsboro', rows: [] });
		expect(await resolveThemeForBuilding(ADMIN, 'bld-1', env)).toEqual(DEFAULT_THEME);
	});

	it('gives an out-of-scope caller the default theme, never another org tokens', async () => {
		const env = fakeDB({ orgName: 'Wellsboro', rows });
		const theme = await resolveThemeForBuilding(OUTSIDER, 'bld-1', env);
		expect(theme).toEqual(DEFAULT_THEME);
	});

	it('ignores an unparseable tokens blob rather than failing the export', async () => {
		const env = fakeDB({
			orgName: 'Wellsboro',
			rows: [{ scope_type: 'org', scope_id: 'org-1', tokens: '{not json' }]
		});
		expect(await resolveThemeForBuilding(ADMIN, 'bld-1', env)).toEqual(DEFAULT_THEME);
	});
});
