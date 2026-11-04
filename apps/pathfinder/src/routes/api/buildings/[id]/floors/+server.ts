// /api/buildings/[id]/floors (Epic E15, AC-15.1.x). The building's floor stack.
//
//   GET  lists the floors in stack order, LOWEST FLOOR FIRST, each with its
//        current plan, because that is the order hallway numbering walks.
//   POST appends a floor.
//   PUT  rewrites the stack order from an explicit id list.
//
// `label` is free text and is stored verbatim: "0", "Main", "3", "1A Annex" are
// all valid and none of them is parsed as a number. Ordering comes only from
// the PUT list. `level` is optional NG911 z-axis metadata and never orders
// anything.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getBuilding, isGlobalScope } from '$lib/server/hierarchy';
import { listFloors, createFloor, reorderFloors } from '$lib/server/floors';

/** Optional integer or explicit null; anything else is a client error. */
function readLevel(raw: unknown): number | null {
	if (raw === undefined || raw === null || raw === '') return null;
	const n = typeof raw === 'string' ? Number(raw) : raw;
	if (typeof n !== 'number' || !Number.isInteger(n)) error(400, 'level must be an integer.');
	return n;
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getBuilding(env, locals.user, params.id))) error(404, 'Building not found.');
	return json({ floors: await listFloors(locals.user, params.id, env) });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getBuilding(env, locals.user, params.id))) error(404, 'Building not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { label?: unknown; level?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	const label = typeof body.label === 'string' ? body.label.trim() : '';
	if (!label) error(400, 'A floor label is required.');

	const floor = await createFloor(
		locals.user,
		params.id,
		{ label, level: readLevel(body.level) },
		env
	);
	if (!floor) error(404, 'Building not found.');
	await audit(env, locals.user.id, 'floor.create', `building:${params.id}`, request);
	return json({ floor }, { status: 201 });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getBuilding(env, locals.user, params.id))) error(404, 'Building not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { floorIds?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!Array.isArray(body.floorIds) || !body.floorIds.every((f) => typeof f === 'string'))
		error(400, 'floorIds must be an array of floor ids.');

	const ok = await reorderFloors(locals.user, params.id, body.floorIds as string[], env);
	if (!ok) error(404, 'Building not found.');
	await audit(env, locals.user.id, 'floor.reorder', `building:${params.id}`, request);
	return json({ floors: await listFloors(locals.user, params.id, env) });
};
