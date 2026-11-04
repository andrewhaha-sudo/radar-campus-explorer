// District browse (Epic E3, AC-3.1.1 / AC-3.2.x). Server-guarded: a 404 for any
// district the caller's scope cannot see (a client cannot reach another org).
// Loads the district, its facilities (direct children), a roll-up, and the
// sibling districts that power the breadcrumb switcher.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getDistrict,
	listFacilities,
	listDistricts,
	rollup
} from '$lib/server/hierarchy';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const district = await getDistrict(env, locals.user, params.id);
	if (!district) error(404, 'District not found.');

	const [facilities, siblings, counts] = await Promise.all([
		listFacilities(env, locals.user, { districtId: district.id }),
		listDistricts(env, locals.user),
		rollup(env, locals.user, { districtId: district.id })
	]);

	return { district, facilities, siblings, counts };
};
