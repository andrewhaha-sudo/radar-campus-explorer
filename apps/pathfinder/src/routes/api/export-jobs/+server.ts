// /api/export-jobs (Epic E6 - batch export). GET lists jobs for a scope; POST
// enqueues a batch map-export job. Rendering runs client-side over the tested
// map engine and reports progress back via PATCH /api/export-jobs/[id].

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope, getDistrict, getFacility, getBuilding, type ScopeUser } from '$lib/server/hierarchy';
import { createJob, listJobs } from '$lib/server/exports';

// A scope is reachable only if the caller can see the underlying entity. Without
// this, a client could read/enqueue jobs for another org by guessing an id.
async function scopeVisible(
	env: { DB: D1Database },
	user: ScopeUser & { id?: string },
	scopeType: string,
	scopeId: string
): Promise<boolean> {
	if (scopeType === 'district') return !!(await getDistrict(env, user, scopeId));
	if (scopeType === 'facility') return !!(await getFacility(env, user, scopeId));
	if (scopeType === 'building') return !!(await getBuilding(env, user, scopeId));
	return false;
}

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const scopeType = url.searchParams.get('scopeType');
	const scopeId = url.searchParams.get('scopeId');
	if (!scopeType || !scopeId) error(400, 'scopeType and scopeId are required.');
	if (!(await scopeVisible(env, locals.user, scopeType, scopeId))) error(404, 'Scope not found.');
	return json({ jobs: await listJobs(env, { scopeType, scopeId }) });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { scopeType?: 'district' | 'facility' | 'building'; scopeId?: string; total?: number };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.scopeType || !body.scopeId) error(400, 'scopeType and scopeId required.');
	if (!(await scopeVisible(env, locals.user, body.scopeType, body.scopeId))) error(404, 'Scope not found.');
	const job = await createJob(env, {
		scopeType: body.scopeType,
		scopeId: body.scopeId,
		total: body.total ?? 0,
		createdBy: locals.user.id
	});
	return json({ job }, { status: 201 });
};
