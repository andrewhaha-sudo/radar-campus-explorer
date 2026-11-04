// Unit + integration tests for the org-hierarchy data-access layer
// (Epic E3 - Org Hierarchy & Dashboards). Covers:
//
//   T-3.1.2 (AC-3.1.2)  the hierarchy is capped at three levels below org.
//   T-3.2.2 (AC-3.2.2)  sibling navigation resolves at the same level (route math).
//   plus the always-on scoping invariant behind AC-2.3.1 / spec 9.3: a client
//   sees only their own org's data, and the rollup() count math is correct.
//
// The pure helpers are tested directly. The scoped DB functions run against a
// small in-memory fake D1 that implements the prepare().bind().first()/all()
// subset this layer uses, so we exercise the real SQL-shaped logic without a
// live Cloudflare binding.

import { describe, it, expect } from 'vitest';
import {
	isGlobalScope,
	canSeeOrg,
	withinDepthCap,
	sumRollup,
	validateName,
	validateFloors,
	validateFacilityType,
	listDistricts,
	listFacilities,
	listBuildings,
	getFacility,
	rollup,
	type ScopeUser
} from '../../src/lib/server/hierarchy';

// --- In-memory fake D1 -------------------------------------------------------
//
// A deliberately small table store. It does not parse SQL; instead it pattern-
// matches the handful of statements hierarchy.ts issues and serves rows from
// the seeded fixture. This keeps the test honest about behavior (scoping,
// counts) without re-implementing SQLite.

interface Tables {
	orgs: Array<{ id: string; name: string }>;
	districts: Array<{ id: string; org_id: string; name: string }>;
	facilities: Array<{ id: string; district_id: string | null; org_id: string; name: string }>;
	buildings: Array<{ id: string; facility_id: string; name: string; floors: number }>;
	projects: Array<{ id: string; building_id: string; name: string }>;
}

function fakeDB(t: Tables) {
	function run(sql: string, binds: unknown[]) {
		const s = sql.replace(/\s+/g, ' ').trim();

		// orgs
		if (s === 'SELECT id FROM orgs WHERE name = ? LIMIT 1') {
			const o = t.orgs.find((x) => x.name === binds[0]);
			return { kind: 'first', row: o ? { id: o.id } : null };
		}
		if (s === 'SELECT name FROM orgs WHERE id = ?') {
			const o = t.orgs.find((x) => x.id === binds[0]);
			return { kind: 'first', row: o ? { name: o.name } : null };
		}

		// districts
		if (s === 'SELECT * FROM districts ORDER BY name') {
			return { kind: 'all', rows: [...t.districts].sort((a, b) => a.name.localeCompare(b.name)) };
		}
		if (s === 'SELECT * FROM districts WHERE org_id = ? ORDER BY name') {
			return {
				kind: 'all',
				rows: t.districts.filter((d) => d.org_id === binds[0]).sort((a, b) => a.name.localeCompare(b.name))
			};
		}
		if (s === 'SELECT d.* FROM districts d WHERE d.id = ?') {
			const d = t.districts.find((x) => x.id === binds[0]);
			return { kind: 'first', row: d ?? null };
		}

		// facilities
		if (s === 'SELECT * FROM facilities ORDER BY name') {
			return { kind: 'all', rows: [...t.facilities].sort((a, b) => a.name.localeCompare(b.name)) };
		}
		if (s === 'SELECT * FROM facilities WHERE org_id = ? ORDER BY name') {
			return {
				kind: 'all',
				rows: t.facilities.filter((f) => f.org_id === binds[0]).sort((a, b) => a.name.localeCompare(b.name))
			};
		}
		if (s === 'SELECT * FROM facilities WHERE district_id = ? ORDER BY name') {
			return {
				kind: 'all',
				rows: t.facilities.filter((f) => f.district_id === binds[0]).sort((a, b) => a.name.localeCompare(b.name))
			};
		}
		if (s === 'SELECT * FROM facilities WHERE id = ?') {
			const f = t.facilities.find((x) => x.id === binds[0]);
			return { kind: 'first', row: f ?? null };
		}

		// buildings
		if (s === 'SELECT * FROM buildings ORDER BY name') {
			return { kind: 'all', rows: [...t.buildings].sort((a, b) => a.name.localeCompare(b.name)) };
		}
		if (s === 'SELECT * FROM buildings WHERE facility_id = ? ORDER BY name') {
			return {
				kind: 'all',
				rows: t.buildings.filter((b) => b.facility_id === binds[0]).sort((a, b) => a.name.localeCompare(b.name))
			};
		}
		if (s.startsWith('SELECT b.* FROM buildings b JOIN facilities f ON f.id = b.facility_id WHERE f.org_id = ?')) {
			const orgId = binds[0];
			const facIds = new Set(t.facilities.filter((f) => f.org_id === orgId).map((f) => f.id));
			return { kind: 'all', rows: t.buildings.filter((b) => facIds.has(b.facility_id)) };
		}
		if (s === 'SELECT * FROM buildings WHERE id = ?') {
			const b = t.buildings.find((x) => x.id === binds[0]);
			return { kind: 'first', row: b ?? null };
		}

		// whole-scope rollup (org-scoped)
		if (s.includes('SELECT (SELECT COUNT(*) FROM districts WHERE org_id = ?1) AS districts')) {
			const orgId = binds[0];
			const facIds = new Set(t.facilities.filter((f) => f.org_id === orgId).map((f) => f.id));
			const bldIds = new Set(t.buildings.filter((b) => facIds.has(b.facility_id)).map((b) => b.id));
			return {
				kind: 'first',
				row: {
					districts: t.districts.filter((d) => d.org_id === orgId).length,
					facilities: t.facilities.filter((f) => f.org_id === orgId).length,
					buildings: t.buildings.filter((b) => facIds.has(b.facility_id)).length,
					projects: t.projects.filter((p) => bldIds.has(p.building_id)).length
				}
			};
		}
		// whole-scope rollup (global)
		if (s.includes('(SELECT COUNT(*) FROM districts) AS districts')) {
			return {
				kind: 'first',
				row: {
					districts: t.districts.length,
					facilities: t.facilities.length,
					buildings: t.buildings.length,
					projects: t.projects.length
				}
			};
		}

		throw new Error('fakeDB: unhandled SQL: ' + s);
	}

	const DB = {
		prepare(sql: string) {
			const stmt = {
				_binds: [] as unknown[],
				bind(...args: unknown[]) {
					stmt._binds = args;
					return stmt;
				},
				async first<T>() {
					const r = run(sql, stmt._binds);
					return (r.row ?? null) as T | null;
				},
				async all<T>() {
					const r = run(sql, stmt._binds);
					return { results: (r.rows ?? []) as T[] };
				}
			};
			return stmt;
		}
	};
	return { DB } as unknown as { DB: D1Database };
}

// --- Fixture: two orgs, each with its own subtree -----------------------------

function fixture() {
	return fakeDB({
		orgs: [
			{ id: 'org-a', name: 'Org A' },
			{ id: 'org-b', name: 'Org B' }
		],
		districts: [
			{ id: 'dA', org_id: 'org-a', name: 'District A' },
			{ id: 'dB', org_id: 'org-b', name: 'District B' }
		],
		facilities: [
			{ id: 'fA1', district_id: 'dA', org_id: 'org-a', name: 'Facility A1' },
			{ id: 'fA2', district_id: 'dA', org_id: 'org-a', name: 'Facility A2' },
			{ id: 'fB1', district_id: 'dB', org_id: 'org-b', name: 'Facility B1' }
		],
		buildings: [
			{ id: 'bA1', facility_id: 'fA1', name: 'Building A1', floors: 2 },
			{ id: 'bA2', facility_id: 'fA1', name: 'Building A2', floors: 1 },
			{ id: 'bB1', facility_id: 'fB1', name: 'Building B1', floors: 3 }
		],
		projects: [
			{ id: 'pA1', building_id: 'bA1', name: 'Project A1' },
			{ id: 'pA2', building_id: 'bA1', name: 'Project A2' },
			{ id: 'pB1', building_id: 'bB1', name: 'Project B1' }
		]
	});
}

const ADMIN: ScopeUser = { role: 'admin', org: 'Pathfinder LiDAR' };
const STAFF: ScopeUser = { role: 'staff', org: null };
const CLIENT_A: ScopeUser = { role: 'client', org: 'Org A' };
const CLIENT_B: ScopeUser = { role: 'client', org: 'Org B' };
const CLIENT_NONE: ScopeUser = { role: 'client', org: null };

// --- Pure helpers ------------------------------------------------------------

describe('scope helpers (pure)', () => {
	it('admin and staff have global scope; clients do not', () => {
		expect(isGlobalScope(ADMIN)).toBe(true);
		expect(isGlobalScope(STAFF)).toBe(true);
		expect(isGlobalScope(CLIENT_A)).toBe(false);
	});

	it('canSeeOrg lets globals see any org, clients only their own', () => {
		expect(canSeeOrg(ADMIN, 'Org B')).toBe(true);
		expect(canSeeOrg(CLIENT_A, 'Org A')).toBe(true);
		expect(canSeeOrg(CLIENT_A, 'Org B')).toBe(false);
		expect(canSeeOrg(CLIENT_NONE, 'Org A')).toBe(false);
	});
});

describe('T-3.1.2 hierarchy depth cap (AC-3.1.2)', () => {
	it('accepts the three canonical levels below org (district, facility, building)', () => {
		expect(withinDepthCap(1)).toBe(true); // district
		expect(withinDepthCap(2)).toBe(true); // facility
		expect(withinDepthCap(3)).toBe(true); // building
	});

	it('rejects a deeper nesting than three levels below org', () => {
		expect(withinDepthCap(4)).toBe(false);
		expect(withinDepthCap(0)).toBe(false);
		expect(withinDepthCap(2.5)).toBe(false);
	});
});

describe('validation rules', () => {
	it('rejects an empty or oversized name', () => {
		expect(validateName('')).not.toBeNull();
		expect(validateName('   ')).not.toBeNull();
		expect(validateName('x'.repeat(201))).not.toBeNull();
		expect(validateName('Wellsboro High')).toBeNull();
	});

	it('rejects non-positive or non-integer floor counts', () => {
		expect(validateFloors(0)).not.toBeNull();
		expect(validateFloors(-1)).not.toBeNull();
		expect(validateFloors(2.5)).not.toBeNull();
		expect(validateFloors(3)).toBeNull();
		expect(validateFloors(undefined)).toBeNull();
	});

	it('rejects an unknown facility type but allows the catalog', () => {
		expect(validateFacilityType('bunker')).not.toBeNull();
		expect(validateFacilityType('school')).toBeNull();
		expect(validateFacilityType('911_center')).toBeNull();
		expect(validateFacilityType(null)).toBeNull();
	});
});

describe('sumRollup count math (pure)', () => {
	it('fills missing buckets with zero and preserves provided counts', () => {
		expect(sumRollup({ facilities: 2, projects: 5 })).toEqual({
			districts: 0,
			facilities: 2,
			buildings: 0,
			projects: 5
		});
	});
});

// --- Scoped DB behavior ------------------------------------------------------

describe('role-scoped reads (client cannot see another org)', () => {
	it('a global role lists every org district', async () => {
		const env = fixture();
		const ds = await listDistricts(env, ADMIN);
		expect(ds.map((d) => d.id).sort()).toEqual(['dA', 'dB']);
	});

	it('a client lists only their own org district', async () => {
		const env = fixture();
		const ds = await listDistricts(env, CLIENT_A);
		expect(ds.map((d) => d.id)).toEqual(['dA']);
	});

	it('a client sees only their own facilities', async () => {
		const env = fixture();
		const fs = await listFacilities(env, CLIENT_A);
		expect(fs.every((f) => f.org_id === 'org-a')).toBe(true);
		expect(fs.map((f) => f.id).sort()).toEqual(['fA1', 'fA2']);
	});

	it('a client sees only their own buildings', async () => {
		const env = fixture();
		const bs = await listBuildings(env, CLIENT_A);
		expect(bs.map((b) => b.id).sort()).toEqual(['bA1', 'bA2']);
	});

	// AC-2.3.1 / spec 9.3: fetching a sibling-org facility by id is denied.
	it('a client requesting another org facility by id gets null (no data leak)', async () => {
		const env = fixture();
		const leaked = await getFacility(env, CLIENT_A, 'fB1');
		expect(leaked).toBeNull();
		// And the rightful owner can still read it.
		const owned = await getFacility(env, CLIENT_B, 'fB1');
		expect(owned?.id).toBe('fB1');
	});

	it('a client with no org sees nothing', async () => {
		const env = fixture();
		expect(await listDistricts(env, CLIENT_NONE)).toEqual([]);
		expect(await listFacilities(env, CLIENT_NONE)).toEqual([]);
	});
});

describe('T-3.2.2 sibling resolution stays at the same level (AC-3.2.2)', () => {
	it('listing buildings under a facility returns the clicked node siblings only', async () => {
		const env = fixture();
		// From Building A1, the breadcrumb building-switcher lists siblings under
		// the same facility (fA1): A1 and A2, not buildings from other facilities.
		const siblings = await listBuildings(env, CLIENT_A, { facilityId: 'fA1' });
		expect(siblings.map((b) => b.id).sort()).toEqual(['bA1', 'bA2']);
		// A client cannot enumerate siblings under another org's facility.
		const denied = await listBuildings(env, CLIENT_A, { facilityId: 'fB1' });
		expect(denied).toEqual([]);
	});
});

describe('rollup() aggregates counts within scope', () => {
	it('a global role rolls up everything', async () => {
		const env = fixture();
		const r = await rollup(env, ADMIN);
		expect(r).toEqual({ districts: 2, facilities: 3, buildings: 3, projects: 3 });
	});

	it('a client rolls up only their own org', async () => {
		const env = fixture();
		const r = await rollup(env, CLIENT_A);
		expect(r).toEqual({ districts: 1, facilities: 2, buildings: 2, projects: 2 });
	});

	it('an org with no visible data rolls up to zeros', async () => {
		const env = fixture();
		const r = await rollup(env, CLIENT_NONE);
		expect(r).toEqual({ districts: 0, facilities: 0, buildings: 0, projects: 0 });
	});
});
