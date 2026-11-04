// Facility browse (Epic E3, AC-3.1.1 / AC-3.2.x / AC-3.4.1). Server-guarded:
// 404 for any facility the caller's scope cannot see. Loads the facility, its
// buildings (direct children), a roll-up, the parent district (if any) for the
// breadcrumb, and sibling facilities for the breadcrumb switcher.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getFacility,
	getDistrict,
	listBuildings,
	listFacilities,
	isGlobalScope,
	rollup
} from '$lib/server/hierarchy';
import { getComplianceMeta } from '$lib/server/compliance';
import { requiredFieldsMissing } from '$lib/engines/compliance/ng911';
import { isStale } from '$lib/engines/compliance/status';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const facility = await getFacility(env, locals.user, params.id);
	if (!facility) error(404, 'Facility not found.');

	const district = facility.district_id
		? await getDistrict(env, locals.user, facility.district_id)
		: null;

	const [buildings, siblings, counts, compliance] = await Promise.all([
		listBuildings(env, locals.user, { facilityId: facility.id }),
		// Siblings: facilities under the same district (or org-wide if standalone).
		listFacilities(env, locals.user, { districtId: facility.district_id ?? undefined }),
		rollup(env, locals.user, { facilityId: facility.id }),
		getComplianceMeta(env, facility.id)
	]);

	const missingFields = requiredFieldsMissing({
		id: facility.id,
		name: facility.name,
		address: facility.address,
		zip: facility.zip,
		phone: facility.phone,
		type: facility.type,
		state: 'PA'
	});

	return {
		facility,
		district,
		buildings,
		siblings,
		counts,
		compliance,
		missingFields,
		stale: isStale(compliance?.last_reviewed ?? null, new Date().toISOString()),
		canEdit: isGlobalScope(locals.user)
	};
};
