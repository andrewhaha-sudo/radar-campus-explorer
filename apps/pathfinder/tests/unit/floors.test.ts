// Floor stack ordering + scoping (Epic E15, AC-15.1.x).
//
// The contract that matters: resolveFloorOrder turns a set of unrelated
// per-floor PDFs into one ordered building, keyed by (doc_id, page), using
// sort_order alone. Labels like "0" / "Main" / "3" must never influence it.

import { describe, it, expect } from 'vitest';
import {
	resolveFloorOrder,
	floorKey,
	listFloors,
	normalizeNorthDeg,
	updateFloor
} from '../../src/lib/server/floors';
import type { ScopeUser } from '../../src/lib/server/hierarchy';

const ADMIN: ScopeUser = { role: 'admin', org: null };
const OUTSIDER: ScopeUser = { role: 'client', org: 'Other District' };

/** Minimal D1 stand-in covering only the statements floors.ts issues. */
function fakeDB(rows: {
	orgName?: string;
	floors: Array<{
		id: string;
		building_id: string;
		label: string;
		level: number | null;
		sort_order: number;
		doc_id: string | null;
		page: number | null;
		version: number | null;
	}>;
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
						return (rows.orgName ? { org_name: rows.orgName } : null) as T | null;
					}
					throw new Error('fakeDB: unhandled first(): ' + s);
				},
				async all<T>() {
					if (s.includes('FROM floors fl')) {
						const buildingId = stmt._binds[0];
						const out = rows.floors
							.filter((f) => f.building_id === buildingId)
							.slice()
							.sort((a, b) => a.sort_order - b.sort_order)
							.map((f) => ({ ...f, needs_review: 0, created_at: '2026-08-18' }));
						return { results: out as T[] };
					}
					throw new Error('fakeDB: unhandled all(): ' + s);
				}
			};
			return stmt;
		}
	};
	return { DB } as unknown as { DB: D1Database };
}

/** Rock L. Butler: three floors, three separate PDFs, arbitrary labels. */
function rockButler() {
	return fakeDB({
		orgName: 'Wellsboro',
		floors: [
			{
				id: 'fl-main',
				building_id: 'bld-1',
				label: 'Main',
				level: 0,
				sort_order: 1,
				doc_id: 'doc-main',
				page: 1,
				version: 1
			},
			{
				id: 'fl-0',
				building_id: 'bld-1',
				label: '0',
				level: -1,
				sort_order: 0,
				doc_id: 'doc-zero',
				page: 1,
				version: 2
			},
			{
				id: 'fl-3',
				building_id: 'bld-1',
				label: '3',
				level: 3,
				sort_order: 2,
				doc_id: 'doc-three',
				page: 1,
				version: 1
			}
		]
	});
}

/** D1 stand-in for updateFloor: resolves the owning building, answers the
 *  scope check, and records the UPDATE it is asked to run. */
function writableDB(orgName: string | null) {
	const writes: Array<{ sql: string; binds: unknown[] }> = [];
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
					if (s.includes('o.name AS org_name'))
						return (orgName ? { org_name: orgName } : null) as T | null;
					if (s.startsWith('SELECT building_id FROM floors'))
						return { building_id: 'bld-1' } as T;
					throw new Error('writableDB: unhandled first(): ' + s);
				},
				async run() {
					writes.push({ sql: s, binds: stmt._binds });
					return { success: true };
				}
			};
			return stmt;
		}
	};
	return { env: { DB } as unknown as { DB: D1Database }, writes };
}

describe('normalizeNorthDeg', () => {
	it('leaves a rotation already inside one turn alone', () => {
		expect(normalizeNorthDeg(0)).toBe(0);
		expect(normalizeNorthDeg(90)).toBe(90);
		expect(normalizeNorthDeg(359.5)).toBe(359.5);
	});

	it('wraps a full turn back to zero', () => {
		expect(normalizeNorthDeg(360)).toBe(0);
		expect(normalizeNorthDeg(450)).toBe(90);
		expect(normalizeNorthDeg(720)).toBe(0);
	});

	it('wraps a counter-clockwise rotation into the same clockwise turn', () => {
		expect(normalizeNorthDeg(-90)).toBe(270);
		expect(normalizeNorthDeg(-450)).toBe(270);
	});

	it('falls back to up-the-page for a value that is not a number', () => {
		expect(normalizeNorthDeg(Number.NaN)).toBe(0);
		expect(normalizeNorthDeg(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('updateFloor - plan geometry', () => {
	it('stores a plan scale and a normalized north rotation', async () => {
		const { env, writes } = writableDB('Wellsboro');
		expect(await updateFloor(ADMIN, 'fl-1', { planScale: 60000, northDeg: 405 }, env)).toBe(true);
		expect(writes).toHaveLength(1);
		expect(writes[0].sql).toContain('plan_scale = ?');
		expect(writes[0].sql).toContain('north_deg = ?');
		expect(writes[0].binds).toEqual([60000, 45, 'fl-1']);
	});

	it('clears the scale back to unknown when given null', async () => {
		const { env, writes } = writableDB('Wellsboro');
		await updateFloor(ADMIN, 'fl-1', { planScale: null }, env);
		expect(writes[0].binds).toEqual([null, 'fl-1']);
	});

	it('stores an unusable scale as unknown rather than as a number to trust', async () => {
		for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
			const { env, writes } = writableDB('Wellsboro');
			await updateFloor(ADMIN, 'fl-1', { planScale: bad }, env);
			expect(writes[0].binds).toEqual([null, 'fl-1']);
		}
	});

	it('leaves geometry untouched when the patch does not mention it', async () => {
		const { env, writes } = writableDB('Wellsboro');
		await updateFloor(ADMIN, 'fl-1', { label: 'Main' }, env);
		expect(writes[0].sql).not.toContain('plan_scale');
		expect(writes[0].sql).not.toContain('north_deg');
	});

	it('refuses a caller outside the org', async () => {
		const { env, writes } = writableDB('Wellsboro');
		expect(await updateFloor(OUTSIDER, 'fl-1', { planScale: 60000 }, env)).toBe(false);
		expect(writes).toHaveLength(0);
	});
});

describe('floorKey', () => {
	it('keys a marker by document and page', () => {
		expect(floorKey('doc-a', 2)).toBe('doc-a:2');
	});
});

describe('listFloors', () => {
	it('returns floors in stack order, lowest first', async () => {
		const env = rockButler();
		const floors = await listFloors(ADMIN, 'bld-1', env);
		expect(floors.map((f) => f.label)).toEqual(['0', 'Main', '3']);
	});

	it('returns nothing to a caller outside the org', async () => {
		const env = rockButler();
		expect(await listFloors(OUTSIDER, 'bld-1', env)).toEqual([]);
	});
});

describe('resolveFloorOrder', () => {
	it('maps each separate PDF to its stack position', async () => {
		const env = rockButler();
		const order = await resolveFloorOrder(ADMIN, 'bld-1', env);
		// the basement is position 0, so its hallways number first
		expect(order[floorKey('doc-zero', 1)]).toBe(0);
		expect(order[floorKey('doc-main', 1)]).toBe(1);
		expect(order[floorKey('doc-three', 1)]).toBe(2);
	});

	it('ignores the label text entirely - "3" sorts above "Main"', async () => {
		const env = rockButler();
		const order = await resolveFloorOrder(ADMIN, 'bld-1', env);
		// A naive numeric parse of the labels would put "0" then "3" then "Main".
		// sort_order is the only truth, so "Main" sits between them.
		expect(order[floorKey('doc-main', 1)]).toBeLessThan(order[floorKey('doc-three', 1)]);
	});

	it('handles several floors sharing one multi-page PDF', async () => {
		const env = fakeDB({
			orgName: 'Wellsboro',
			floors: [
				{
					id: 'a',
					building_id: 'b1',
					label: 'First',
					level: 1,
					sort_order: 0,
					doc_id: 'doc-multi',
					page: 1,
					version: 1
				},
				{
					id: 'b',
					building_id: 'b1',
					label: 'Second',
					level: 2,
					sort_order: 1,
					doc_id: 'doc-multi',
					page: 2,
					version: 1
				}
			]
		});
		const order = await resolveFloorOrder(ADMIN, 'b1', env);
		expect(order[floorKey('doc-multi', 1)]).toBe(0);
		expect(order[floorKey('doc-multi', 2)]).toBe(1);
	});

	it('omits a floor that has no current plan yet', async () => {
		const env = fakeDB({
			orgName: 'Wellsboro',
			floors: [
				{
					id: 'a',
					building_id: 'b1',
					label: 'Planned',
					level: 1,
					sort_order: 0,
					doc_id: null,
					page: null,
					version: null
				}
			]
		});
		expect(await resolveFloorOrder(ADMIN, 'b1', env)).toEqual({});
	});

	it('returns an empty order to a caller outside the org', async () => {
		const env = rockButler();
		expect(await resolveFloorOrder(OUTSIDER, 'bld-1', env)).toEqual({});
	});
});
