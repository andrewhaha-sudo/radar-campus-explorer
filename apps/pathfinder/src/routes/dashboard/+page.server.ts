// Dashboard load (Epic E3 - roll-up dashboard). The hooks guard already
// redirects anonymous users to /login; here we aggregate the caller's scoped
// roll-up counts (districts/facilities/buildings/projects) and a facility list
// for quick links. All reads are role-scoped server-side (hierarchy.ts).

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rollup, listFacilities, listDistricts } from '$lib/server/hierarchy';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) redirect(303, '/login');
	const env = platform?.env;

	// Degrade gracefully if the DB binding is somehow absent (keeps the shell up).
	if (!env?.DB) {
		return {
			user: locals.user,
			counts: { districts: 0, facilities: 0, buildings: 0, projects: 0 },
			facilities: [],
			districts: []
		};
	}

	const [counts, facilities, districts] = await Promise.all([
		rollup(env, locals.user),
		listFacilities(env, locals.user),
		listDistricts(env, locals.user)
	]);

	return { user: locals.user, counts, facilities, districts };
};
