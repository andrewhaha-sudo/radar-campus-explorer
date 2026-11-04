// Scan-library data-access layer (Epic E7). Scoped reads mirror hierarchy.ts:
// a media asset is visible only if its building/facility -> org is visible to
// the caller. Clients only ever see served, active assets (the cold master PLY
// is never listed or streamed to them). Storage-tier decisions come from the
// pure storage-policy module.

import { uuid } from './auth';
import { canSeeOrg, type ScopeUser } from './hierarchy';
import { routeStorage, type MediaType } from '$lib/engines/media/storage-policy';

type Env = { DB: D1Database };

export interface MediaAsset {
	id: string;
	building_id: string | null;
	facility_id: string | null;
	type: MediaType;
	filename: string;
	r2_key: string;
	storage_tier: 'hot' | 'cold';
	served: number;
	size: number | null;
	version: number;
	capture_date: string | null;
	surveyor: string | null;
	floor: number | null;
	status: 'pending' | 'active' | 'archived';
	upload_id: string | null;
	uploaded_by: string | null;
	created_at: string;
}

/** Org name owning a building (for scope checks). */
async function buildingOrgName(env: Env, buildingId: string): Promise<string | null> {
	const row = await env.DB.prepare(
		`SELECT o.name AS org_name FROM buildings b
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o ON o.id = f.org_id
		  WHERE b.id = ?`
	)
		.bind(buildingId)
		.first<{ org_name: string }>();
	return row?.org_name ?? null;
}

async function facilityOrgName(env: Env, facilityId: string): Promise<string | null> {
	const row = await env.DB.prepare(
		`SELECT o.name AS org_name FROM facilities f JOIN orgs o ON o.id = f.org_id WHERE f.id = ?`
	)
		.bind(facilityId)
		.first<{ org_name: string }>();
	return row?.org_name ?? null;
}

/** Can the caller see assets under this building/facility? */
async function canSeeScope(
	env: Env,
	user: ScopeUser,
	scope: { buildingId?: string; facilityId?: string }
): Promise<boolean> {
	let org: string | null = null;
	if (scope.buildingId) org = await buildingOrgName(env, scope.buildingId);
	else if (scope.facilityId) org = await facilityOrgName(env, scope.facilityId);
	if (org === null) return user.role !== 'client';
	return canSeeOrg(user, org);
}

export async function listMedia(
	env: Env,
	user: ScopeUser,
	scope: { buildingId?: string; facilityId?: string }
): Promise<MediaAsset[]> {
	if (!(await canSeeScope(env, user, scope))) return [];
	const col = scope.buildingId ? 'building_id' : 'facility_id';
	const id = scope.buildingId ?? scope.facilityId;
	if (!id) return [];
	// Clients never see cold/unserved masters; staff/admin see everything.
	const servedClause = user.role === 'client' ? "AND served = 1 AND status = 'active'" : '';
	const { results } = await env.DB.prepare(
		`SELECT * FROM media_assets WHERE ${col} = ? ${servedClause} ORDER BY type, version DESC, created_at DESC`
	)
		.bind(id)
		.all<MediaAsset>();
	return results ?? [];
}

export async function getMedia(env: Env, user: ScopeUser, id: string): Promise<MediaAsset | null> {
	const row = await env.DB.prepare('SELECT * FROM media_assets WHERE id = ?')
		.bind(id)
		.first<MediaAsset>();
	if (!row) return null;
	const ok = await canSeeScope(env, user, {
		buildingId: row.building_id ?? undefined,
		facilityId: row.facility_id ?? undefined
	});
	if (!ok) return null;
	// A client may not fetch a never-served master even by id.
	if (user.role === 'client' && row.served === 0) return null;
	return row;
}

/** Next version number for an asset family (same building + type + filename). */
export async function nextVersion(
	env: Env,
	buildingId: string | null,
	type: MediaType,
	filename: string
): Promise<number> {
	const row = await env.DB.prepare(
		`SELECT MAX(version) AS v FROM media_assets
		  WHERE building_id IS ? AND type = ? AND filename = ?`
	)
		.bind(buildingId, type, filename)
		.first<{ v: number | null }>();
	return (row?.v ?? 0) + 1;
}

/** Insert a pending media row at the start of a multipart upload. */
export async function createPending(
	env: Env,
	input: {
		building_id: string | null;
		facility_id: string | null;
		type: MediaType;
		filename: string;
		r2_key: string;
		size: number;
		version: number;
		upload_id: string;
		capture_date?: string | null;
		surveyor?: string | null;
		floor?: number | null;
		uploaded_by?: string | null;
	}
): Promise<MediaAsset> {
	const id = uuid();
	const route = routeStorage(input.type);
	await env.DB.prepare(
		`INSERT INTO media_assets
		  (id, building_id, facility_id, type, filename, r2_key, storage_tier, served, size, version, capture_date, surveyor, floor, status, upload_id, uploaded_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
	)
		.bind(
			id,
			input.building_id,
			input.facility_id,
			input.type,
			input.filename,
			input.r2_key,
			route.tier,
			route.served ? 1 : 0,
			input.size,
			input.version,
			input.capture_date ?? null,
			input.surveyor ?? null,
			input.floor ?? null,
			input.upload_id,
			input.uploaded_by ?? null
		)
		.run();
	return (await env.DB.prepare('SELECT * FROM media_assets WHERE id = ?').bind(id).first<MediaAsset>())!;
}

export async function markActive(env: Env, id: string): Promise<void> {
	await env.DB.prepare("UPDATE media_assets SET status = 'active', upload_id = NULL WHERE id = ?")
		.bind(id)
		.run();
}

export async function deleteMedia(env: Env, id: string): Promise<void> {
	await env.DB.prepare('DELETE FROM media_assets WHERE id = ?').bind(id).run();
}
