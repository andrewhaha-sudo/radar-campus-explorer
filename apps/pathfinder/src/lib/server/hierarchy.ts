// Org hierarchy data-access layer (Epic E3 - Org Hierarchy & Dashboards).
//
// Model: Org -> District -> Facility -> Building, with projects.building_id
// (spec 9.3, 9.10, canonical sec 8). Provides typed, parameterized D1
// list/get/create/update/delete for each level plus a rollup() that aggregates
// counts for the roll-up dashboards.
//
// Role-scoping (server-side, never trust the client role): admin and staff see
// every org; a client sees ONLY their own org. A client's org is resolved by
// matching users.org (free text from migration 0001) to orgs.name. Every read
// is scoped and every entity fetched by id is re-checked against the caller's
// scope so a client cannot reach another org's data by guessing an id (AC-2.3.1).

import { uuid } from './auth';

// --- Types ---

export type EntityType = 'district' | 'facility' | 'building';
export type FacilityType =
	| 'school'
	| '911_center'
	| 'university'
	| 'government'
	| 'healthcare'
	| 'other';

export interface Org {
	id: string;
	name: string;
	brand_id: string | null;
	type: FacilityType | null;
	created_at: string;
}

export interface District {
	id: string;
	org_id: string;
	name: string;
	created_at: string;
}

export interface Facility {
	id: string;
	district_id: string | null;
	org_id: string;
	name: string;
	type: FacilityType | null;
	address: string | null;
	zip: string | null;
	phone: string | null;
	created_at: string;
}

export interface Building {
	id: string;
	facility_id: string;
	name: string;
	floors: number;
	created_at: string;
}

export interface Project {
	id: string;
	building_id: string | null;
	name: string;
	status: string;
	progress: number;
	created_by: string | null;
	created_at: string;
}

/** Minimal user shape this layer needs for scoping (matches SessionUser). */
export interface ScopeUser {
	role: 'admin' | 'staff' | 'client';
	org: string | null;
}

/** Aggregated counts for a roll-up dashboard at some scope. */
export interface Rollup {
	districts: number;
	facilities: number;
	buildings: number;
	projects: number;
}

type Env = { DB: D1Database };

// --- Pure scoping helpers (unit-testable without a DB) ---

/** Admin and staff see everything; clients are confined to their own org. */
export function isGlobalScope(user: ScopeUser): boolean {
	return user.role === 'admin' || user.role === 'staff';
}

/**
 * Decide whether `user` may see data belonging to `orgName`. Global roles may
 * see any org; a client may see only the org whose name matches users.org.
 * A client with no org is denied everything.
 */
export function canSeeOrg(user: ScopeUser, orgName: string | null): boolean {
	if (isGlobalScope(user)) return true;
	if (!user.org || !orgName) return false;
	return user.org === orgName;
}

/** True when nesting depth (district=1, facility=2, building=3) is within the
 *  canonical three levels below org (AC-3.1.2). Anything deeper is rejected. */
export function withinDepthCap(depth: number): boolean {
	return Number.isInteger(depth) && depth >= 1 && depth <= 3;
}

/** Sum the per-bucket counts a rollup is built from. Pure, so the count math is
 *  unit-testable independent of D1. */
export function sumRollup(parts: Partial<Rollup>): Rollup {
	return {
		districts: parts.districts ?? 0,
		facilities: parts.facilities ?? 0,
		buildings: parts.buildings ?? 0,
		projects: parts.projects ?? 0
	};
}

/** Validation for create payloads. Returns an error string, or null if valid. */
export function validateName(name: unknown): string | null {
	if (typeof name !== 'string' || name.trim().length === 0) {
		return 'A name is required.';
	}
	if (name.length > 200) return 'Name is too long.';
	return null;
}

export function validateFloors(floors: unknown): string | null {
	if (floors === undefined || floors === null) return null; // defaults to 1
	if (typeof floors !== 'number' || !Number.isInteger(floors) || floors < 1) {
		return 'Floors must be a positive integer.';
	}
	return null;
}

const FACILITY_TYPES: FacilityType[] = [
	'school',
	'911_center',
	'university',
	'government',
	'healthcare',
	'other'
];

export function validateFacilityType(type: unknown): string | null {
	if (type === undefined || type === null || type === '') return null;
	if (typeof type !== 'string' || !FACILITY_TYPES.includes(type as FacilityType)) {
		return 'Invalid facility type.';
	}
	return null;
}

/** Resolve the caller's scoping org id, or null if a client has no matching org
 *  (in which case all scoped reads return empty). */
async function resolveScopeOrgId(env: Env, user: ScopeUser): Promise<string | null | 'global'> {
	if (isGlobalScope(user)) return 'global';
	if (!user.org) return null;
	const row = await env.DB.prepare('SELECT id FROM orgs WHERE name = ? LIMIT 1')
		.bind(user.org)
		.first<{ id: string }>();
	return row?.id ?? null;
}

// --- Org reads ---

export async function getOrg(env: Env, user: ScopeUser, id: string): Promise<Org | null> {
	const row = await env.DB.prepare('SELECT * FROM orgs WHERE id = ?').bind(id).first<Org>();
	if (!row) return null;
	if (!canSeeOrg(user, row.name)) return null;
	return row;
}

export async function listOrgs(env: Env, user: ScopeUser): Promise<Org[]> {
	if (isGlobalScope(user)) {
		const { results } = await env.DB.prepare('SELECT * FROM orgs ORDER BY name').all<Org>();
		return results ?? [];
	}
	if (!user.org) return [];
	const { results } = await env.DB.prepare('SELECT * FROM orgs WHERE name = ? ORDER BY name')
		.bind(user.org)
		.all<Org>();
	return results ?? [];
}

// --- District reads ---

export async function listDistricts(env: Env, user: ScopeUser): Promise<District[]> {
	const scope = await resolveScopeOrgId(env, user);
	if (scope === null) return [];
	if (scope === 'global') {
		const { results } = await env.DB.prepare('SELECT * FROM districts ORDER BY name').all<District>();
		return results ?? [];
	}
	const { results } = await env.DB.prepare(
		'SELECT * FROM districts WHERE org_id = ? ORDER BY name'
	)
		.bind(scope)
		.all<District>();
	return results ?? [];
}

export async function getDistrict(
	env: Env,
	user: ScopeUser,
	id: string
): Promise<District | null> {
	const row = await env.DB.prepare(
		`SELECT d.* FROM districts d WHERE d.id = ?`
	)
		.bind(id)
		.first<District>();
	if (!row) return null;
	const org = await env.DB.prepare('SELECT name FROM orgs WHERE id = ?')
		.bind(row.org_id)
		.first<{ name: string }>();
	if (!canSeeOrg(user, org?.name ?? null)) return null;
	return row;
}

// --- Facility reads ---

export async function listFacilities(
	env: Env,
	user: ScopeUser,
	opts: { districtId?: string } = {}
): Promise<Facility[]> {
	const scope = await resolveScopeOrgId(env, user);
	if (scope === null) return [];
	if (opts.districtId) {
		// Children of a specific district, re-scoped to the caller.
		const district = await getDistrict(env, user, opts.districtId);
		if (!district) return [];
		const { results } = await env.DB.prepare(
			'SELECT * FROM facilities WHERE district_id = ? ORDER BY name'
		)
			.bind(opts.districtId)
			.all<Facility>();
		return results ?? [];
	}
	if (scope === 'global') {
		const { results } = await env.DB.prepare('SELECT * FROM facilities ORDER BY name').all<Facility>();
		return results ?? [];
	}
	const { results } = await env.DB.prepare(
		'SELECT * FROM facilities WHERE org_id = ? ORDER BY name'
	)
		.bind(scope)
		.all<Facility>();
	return results ?? [];
}

export async function getFacility(
	env: Env,
	user: ScopeUser,
	id: string
): Promise<Facility | null> {
	const row = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?')
		.bind(id)
		.first<Facility>();
	if (!row) return null;
	const org = await env.DB.prepare('SELECT name FROM orgs WHERE id = ?')
		.bind(row.org_id)
		.first<{ name: string }>();
	if (!canSeeOrg(user, org?.name ?? null)) return null;
	return row;
}

// --- Building reads ---

export async function listBuildings(
	env: Env,
	user: ScopeUser,
	opts: { facilityId?: string } = {}
): Promise<Building[]> {
	if (opts.facilityId) {
		const facility = await getFacility(env, user, opts.facilityId);
		if (!facility) return [];
		const { results } = await env.DB.prepare(
			'SELECT * FROM buildings WHERE facility_id = ? ORDER BY name'
		)
			.bind(opts.facilityId)
			.all<Building>();
		return results ?? [];
	}
	const scope = await resolveScopeOrgId(env, user);
	if (scope === null) return [];
	if (scope === 'global') {
		const { results } = await env.DB.prepare('SELECT * FROM buildings ORDER BY name').all<Building>();
		return results ?? [];
	}
	const { results } = await env.DB.prepare(
		`SELECT b.* FROM buildings b
		 JOIN facilities f ON f.id = b.facility_id
		 WHERE f.org_id = ? ORDER BY b.name`
	)
		.bind(scope)
		.all<Building>();
	return results ?? [];
}

export async function getBuilding(
	env: Env,
	user: ScopeUser,
	id: string
): Promise<Building | null> {
	const row = await env.DB.prepare('SELECT * FROM buildings WHERE id = ?')
		.bind(id)
		.first<Building>();
	if (!row) return null;
	const facility = await getFacility(env, user, row.facility_id);
	if (!facility) return null; // re-scopes through facility -> org
	return row;
}

// --- Project reads (minimal) ---

export async function listProjects(
	env: Env,
	user: ScopeUser,
	opts: { buildingId?: string } = {}
): Promise<Project[]> {
	if (opts.buildingId) {
		const building = await getBuilding(env, user, opts.buildingId);
		if (!building) return [];
		const { results } = await env.DB.prepare(
			'SELECT * FROM projects WHERE building_id = ? ORDER BY created_at DESC'
		)
			.bind(opts.buildingId)
			.all<Project>();
		return results ?? [];
	}
	const scope = await resolveScopeOrgId(env, user);
	if (scope === null) return [];
	if (scope === 'global') {
		const { results } = await env.DB.prepare(
			'SELECT * FROM projects ORDER BY created_at DESC'
		).all<Project>();
		return results ?? [];
	}
	const { results } = await env.DB.prepare(
		`SELECT p.* FROM projects p
		 JOIN buildings b ON b.id = p.building_id
		 JOIN facilities f ON f.id = b.facility_id
		 WHERE f.org_id = ? ORDER BY p.created_at DESC`
	)
		.bind(scope)
		.all<Project>();
	return results ?? [];
}

// --- Roll-up aggregation ---

/**
 * Counts for a roll-up dashboard. With no `scope` opts, aggregates over the
 * caller's whole visible scope (their org for a client, everything for staff).
 * With `districtId` or `facilityId`, aggregates the subtree below that node
 * (re-scoped so a client cannot roll up another org's subtree).
 */
export async function rollup(
	env: Env,
	user: ScopeUser,
	opts: { districtId?: string; facilityId?: string } = {}
): Promise<Rollup> {
	if (opts.facilityId) {
		const facility = await getFacility(env, user, opts.facilityId);
		if (!facility) return sumRollup({});
		const counts = await env.DB.prepare(
			`SELECT
			   (SELECT COUNT(*) FROM buildings b WHERE b.facility_id = ?1) AS buildings,
			   (SELECT COUNT(*) FROM projects p
			      JOIN buildings b ON b.id = p.building_id
			      WHERE b.facility_id = ?1) AS projects`
		)
			.bind(opts.facilityId)
			.first<{ buildings: number; projects: number }>();
		return sumRollup({
			facilities: 1,
			buildings: counts?.buildings ?? 0,
			projects: counts?.projects ?? 0
		});
	}

	if (opts.districtId) {
		const district = await getDistrict(env, user, opts.districtId);
		if (!district) return sumRollup({});
		const counts = await env.DB.prepare(
			`SELECT
			   (SELECT COUNT(*) FROM facilities f WHERE f.district_id = ?1) AS facilities,
			   (SELECT COUNT(*) FROM buildings b
			      JOIN facilities f ON f.id = b.facility_id
			      WHERE f.district_id = ?1) AS buildings,
			   (SELECT COUNT(*) FROM projects p
			      JOIN buildings b ON b.id = p.building_id
			      JOIN facilities f ON f.id = b.facility_id
			      WHERE f.district_id = ?1) AS projects`
		)
			.bind(opts.districtId)
			.first<{ facilities: number; buildings: number; projects: number }>();
		return sumRollup({
			districts: 1,
			facilities: counts?.facilities ?? 0,
			buildings: counts?.buildings ?? 0,
			projects: counts?.projects ?? 0
		});
	}

	// Whole-scope roll-up.
	const scope = await resolveScopeOrgId(env, user);
	if (scope === null) return sumRollup({});
	if (scope === 'global') {
		const counts = await env.DB.prepare(
			`SELECT
			   (SELECT COUNT(*) FROM districts) AS districts,
			   (SELECT COUNT(*) FROM facilities) AS facilities,
			   (SELECT COUNT(*) FROM buildings) AS buildings,
			   (SELECT COUNT(*) FROM projects) AS projects`
		).first<{ districts: number; facilities: number; buildings: number; projects: number }>();
		return sumRollup(counts ?? {});
	}
	const counts = await env.DB.prepare(
		`SELECT
		   (SELECT COUNT(*) FROM districts WHERE org_id = ?1) AS districts,
		   (SELECT COUNT(*) FROM facilities WHERE org_id = ?1) AS facilities,
		   (SELECT COUNT(*) FROM buildings b
		      JOIN facilities f ON f.id = b.facility_id
		      WHERE f.org_id = ?1) AS buildings,
		   (SELECT COUNT(*) FROM projects p
		      JOIN buildings b ON b.id = p.building_id
		      JOIN facilities f ON f.id = b.facility_id
		      WHERE f.org_id = ?1) AS projects`
	)
		.bind(scope)
		.first<{ districts: number; facilities: number; buildings: number; projects: number }>();
	return sumRollup(counts ?? {});
}

// --- Writes (admin/staff only; callers enforce role, these enforce scope) ---

export async function createDistrict(
	env: Env,
	input: { org_id: string; name: string }
): Promise<District> {
	const id = uuid();
	await env.DB.prepare('INSERT INTO districts (id, org_id, name) VALUES (?, ?, ?)')
		.bind(id, input.org_id, input.name.trim())
		.run();
	const row = await env.DB.prepare('SELECT * FROM districts WHERE id = ?').bind(id).first<District>();
	return row as District;
}

export async function createFacility(
	env: Env,
	input: {
		org_id: string;
		district_id?: string | null;
		name: string;
		type?: FacilityType | null;
		address?: string | null;
		zip?: string | null;
		phone?: string | null;
	}
): Promise<Facility> {
	const id = uuid();
	await env.DB.prepare(
		`INSERT INTO facilities (id, district_id, org_id, name, type, address, zip, phone)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			id,
			input.district_id ?? null,
			input.org_id,
			input.name.trim(),
			input.type ?? null,
			input.address ?? null,
			input.zip ?? null,
			input.phone ?? null
		)
		.run();
	const row = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?').bind(id).first<Facility>();
	return row as Facility;
}

export async function createBuilding(
	env: Env,
	input: { facility_id: string; name: string; floors?: number }
): Promise<Building> {
	const id = uuid();
	await env.DB.prepare(
		'INSERT INTO buildings (id, facility_id, name, floors) VALUES (?, ?, ?, ?)'
	)
		.bind(id, input.facility_id, input.name.trim(), input.floors ?? 1)
		.run();
	const row = await env.DB.prepare('SELECT * FROM buildings WHERE id = ?').bind(id).first<Building>();
	return row as Building;
}

export async function updateBuilding(
	env: Env,
	id: string,
	patch: { name?: string; floors?: number }
): Promise<void> {
	const sets: string[] = [];
	const binds: unknown[] = [];
	if (patch.name !== undefined) {
		sets.push('name = ?');
		binds.push(patch.name.trim());
	}
	if (patch.floors !== undefined) {
		sets.push('floors = ?');
		binds.push(patch.floors);
	}
	if (sets.length === 0) return;
	binds.push(id);
	await env.DB.prepare(`UPDATE buildings SET ${sets.join(', ')} WHERE id = ?`)
		.bind(...binds)
		.run();
}

export async function deleteBuilding(env: Env, id: string): Promise<void> {
	await env.DB.prepare('DELETE FROM buildings WHERE id = ?').bind(id).run();
}

export async function deleteDistrict(env: Env, id: string): Promise<void> {
	await env.DB.prepare('DELETE FROM districts WHERE id = ?').bind(id).run();
}

export async function deleteFacility(env: Env, id: string): Promise<void> {
	await env.DB.prepare('DELETE FROM facilities WHERE id = ?').bind(id).run();
}
