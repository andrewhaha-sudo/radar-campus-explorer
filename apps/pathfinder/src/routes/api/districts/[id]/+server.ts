// /api/districts/[id] (Epic E3). GET a single district (scoped); DELETE it
// (admin/staff only). A client requesting another org's district by id gets 404
// (no data leak, AC-2.3.1).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getDistrict, deleteDistrict, isGlobalScope } from '$lib/server/hierarchy';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const district = await getDistrict(env, locals.user, params.id);
	if (!district) error(404, 'District not found.');
	return json({ district });
};

export const DELETE: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	// Re-scope: even staff can only delete what their scope can see.
	const district = await getDistrict(env, locals.user, params.id);
	if (!district) error(404, 'District not found.');
	await deleteDistrict(env, params.id);
	await audit(env, locals.user.id, 'hierarchy.district.delete', `district:${params.id}`, request);
	return json({ ok: true });
};
