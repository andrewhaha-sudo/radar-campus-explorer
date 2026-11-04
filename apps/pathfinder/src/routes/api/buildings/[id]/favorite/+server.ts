// /api/buildings/[id]/favorite (Epic E3, AC-3.5.1). POST stars, DELETE unstars
// for the current user. Scoped: the building must be visible to the caller.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBuilding } from '$lib/server/hierarchy';
import { setFavorite, isFavorite } from '$lib/server/favorites';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getBuilding(env, locals.user, params.id))) error(404, 'Building not found.');
	return json({ favorite: await isFavorite(env, locals.user.id, params.id) });
};

export const POST: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getBuilding(env, locals.user, params.id))) error(404, 'Building not found.');
	await setFavorite(env, locals.user.id, params.id, true);
	return json({ ok: true, favorite: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getBuilding(env, locals.user, params.id))) error(404, 'Building not found.');
	await setFavorite(env, locals.user.id, params.id, false);
	return json({ ok: true, favorite: false });
};
