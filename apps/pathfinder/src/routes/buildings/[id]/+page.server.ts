// Building browse (Epic E3, AC-3.1.1 / AC-3.2.1 / AC-3.2.2). Server-guarded:
// 404 for any building the caller's scope cannot see. Loads the building, its
// projects, the parent facility for the breadcrumb, and the sibling buildings
// (same facility) that power the breadcrumb switcher - the canonical example
// from research/04 (clicking a building name opens its sibling buildings).

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBuilding, getFacility, listBuildings, listProjects, isGlobalScope } from '$lib/server/hierarchy';
import { listBuildingDocuments } from '$lib/server/documents';
import { listMedia } from '$lib/server/media';
import { isFavorite } from '$lib/server/favorites';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const building = await getBuilding(env, locals.user, params.id);
	if (!building) error(404, 'Building not found.');

	const facility = await getFacility(env, locals.user, building.facility_id);

	const [siblings, projects, documents, media, favorite] = await Promise.all([
		listBuildings(env, locals.user, { facilityId: building.facility_id }),
		listProjects(env, locals.user, { buildingId: building.id }),
		listBuildingDocuments(env, locals.user, building.id),
		listMedia(env, locals.user, { buildingId: building.id }),
		isFavorite(env, locals.user.id, building.id)
	]);

	return { building, facility, siblings, projects, documents, media, favorite, canEdit: isGlobalScope(locals.user) };
};
