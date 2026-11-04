// /api/facilities/[id] (Epic E3). GET a single facility (scoped); DELETE it
// (admin/staff only). A client requesting another org's facility by id gets 404
// (AC-2.3.1 - no Org B data is returned).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getFacility, deleteFacility, isGlobalScope } from '$lib/server/hierarchy';
import { removeFromIndex } from '$lib/server/search';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const facility = await getFacility(env, locals.user, params.id);
	if (!facility) error(404, 'Facility not found.');
	return json({ facility });
};

export const DELETE: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const facility = await getFacility(env, locals.user, params.id);
	if (!facility) error(404, 'Facility not found.');
	await deleteFacility(env, params.id);
	await removeFromIndex(env, 'facility', params.id);
	await audit(env, locals.user.id, 'hierarchy.facility.delete', `facility:${params.id}`, request);
	return json({ ok: true });
};
