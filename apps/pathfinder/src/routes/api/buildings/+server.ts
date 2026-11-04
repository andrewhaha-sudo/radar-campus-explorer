// /api/buildings (Epic E3). GET lists buildings scoped to the caller
// (optionally filtered by ?facilityId=); POST creates a building (admin/staff
// only). Server-side authorization from locals.user.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import {
	listBuildings,
	createBuilding,
	getFacility,
	isGlobalScope,
	validateName,
	validateFloors
} from '$lib/server/hierarchy';
import { indexEntity } from '$lib/server/search';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const facilityId = url.searchParams.get('facilityId') || undefined;
	const buildings = await listBuildings(env, locals.user, { facilityId });
	return json({ buildings });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { facility_id?: string; name?: string; floors?: number };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	const nameErr = validateName(body.name);
	if (nameErr) error(400, nameErr);
	const floorsErr = validateFloors(body.floors);
	if (floorsErr) error(400, floorsErr);
	if (!body.facility_id) error(400, 'facility_id is required.');

	// The facility must exist and be visible to the caller before writing.
	const facility = await getFacility(env, locals.user, body.facility_id);
	if (!facility) error(404, 'Facility not found.');

	const building = await createBuilding(env, {
		facility_id: body.facility_id,
		name: body.name as string,
		floors: body.floors
	});
	await audit(env, locals.user.id, 'hierarchy.building.create', `building:${building.id}`, request);
	await indexEntity(env, 'building', building.id, building.name, 'Building', `/buildings/${building.id}`);
	return json({ building }, { status: 201 });
};
