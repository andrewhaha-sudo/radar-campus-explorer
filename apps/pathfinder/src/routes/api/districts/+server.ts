// /api/districts (Epic E3). GET lists districts scoped to the caller; POST
// creates a district (admin/staff only). Authorization is enforced server-side
// from locals.user.role - the client-supplied role is never trusted.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import {
	listDistricts,
	createDistrict,
	isGlobalScope,
	validateName,
	getOrg
} from '$lib/server/hierarchy';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const districts = await listDistricts(env, locals.user);
	return json({ districts });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { org_id?: string; name?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	const nameErr = validateName(body.name);
	if (nameErr) error(400, nameErr);
	if (!body.org_id) error(400, 'org_id is required.');

	// Confirm the org exists and is visible to the caller before writing.
	const org = await getOrg(env, locals.user, body.org_id);
	if (!org) error(404, 'Org not found.');

	const district = await createDistrict(env, { org_id: body.org_id, name: body.name as string });
	await audit(env, locals.user.id, 'hierarchy.district.create', `district:${district.id}`, request);
	return json({ district }, { status: 201 });
};
