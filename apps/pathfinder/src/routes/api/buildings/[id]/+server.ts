// /api/buildings/[id] (Epic E3). GET a single building (scoped); PUT updates
// name/floors (admin/staff only); DELETE removes it (admin/staff only). All
// re-scoped: a client cannot reach another org's building by id.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import {
	getBuilding,
	updateBuilding,
	deleteBuilding,
	isGlobalScope,
	validateName,
	validateFloors
} from '$lib/server/hierarchy';
import { indexEntity, removeFromIndex } from '$lib/server/search';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const building = await getBuilding(env, locals.user, params.id);
	if (!building) error(404, 'Building not found.');
	return json({ building });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const building = await getBuilding(env, locals.user, params.id);
	if (!building) error(404, 'Building not found.');

	let body: { name?: string; floors?: number };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (body.name !== undefined) {
		const nameErr = validateName(body.name);
		if (nameErr) error(400, nameErr);
	}
	if (body.floors !== undefined) {
		const floorsErr = validateFloors(body.floors);
		if (floorsErr) error(400, floorsErr);
	}

	await updateBuilding(env, params.id, { name: body.name, floors: body.floors });
	await audit(env, locals.user.id, 'hierarchy.building.update', `building:${params.id}`, request);
	const updated = await getBuilding(env, locals.user, params.id);
	if (updated) await indexEntity(env, 'building', updated.id, updated.name, 'Building', `/buildings/${updated.id}`);
	return json({ building: updated });
};

export const DELETE: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const building = await getBuilding(env, locals.user, params.id);
	if (!building) error(404, 'Building not found.');
	await deleteBuilding(env, params.id);
	await removeFromIndex(env, 'building', params.id);
	await audit(env, locals.user.id, 'hierarchy.building.delete', `building:${params.id}`, request);
	return json({ ok: true });
};
