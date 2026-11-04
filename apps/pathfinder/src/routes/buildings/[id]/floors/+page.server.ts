// Floor stack assembly (Epic E15, AC-15.1.x). Server-guarded: 404 for any
// building the caller's scope cannot see.
//
// Loads the stack in order (lowest floor first) plus the building's documents,
// since attaching a plan to a floor means picking a (document, page) pair.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBuilding, getFacility, isGlobalScope } from '$lib/server/hierarchy';
import { listBuildingDocuments } from '$lib/server/documents';
import { listFloors } from '$lib/server/floors';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const building = await getBuilding(env, locals.user, params.id);
	if (!building) error(404, 'Building not found.');

	const [facility, floors, documents] = await Promise.all([
		getFacility(env, locals.user, building.facility_id),
		listFloors(locals.user, building.id, env),
		listBuildingDocuments(env, locals.user, building.id)
	]);

	return { building, facility, floors, documents, canEdit: isGlobalScope(locals.user) };
};
