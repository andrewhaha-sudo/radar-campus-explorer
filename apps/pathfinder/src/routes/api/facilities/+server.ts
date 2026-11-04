// /api/facilities (Epic E3). GET lists facilities scoped to the caller
// (optionally filtered by ?districtId=); POST creates a facility (admin/staff
// only). Server-side authorization from locals.user.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import {
	listFacilities,
	createFacility,
	getOrg,
	getDistrict,
	isGlobalScope,
	validateName,
	validateFacilityType,
	type FacilityType
} from '$lib/server/hierarchy';
import { indexEntity } from '$lib/server/search';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const districtId = url.searchParams.get('districtId') || undefined;
	const facilities = await listFacilities(env, locals.user, { districtId });
	return json({ facilities });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: {
		org_id?: string;
		district_id?: string | null;
		name?: string;
		type?: string;
		address?: string;
		zip?: string;
		phone?: string;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	const nameErr = validateName(body.name);
	if (nameErr) error(400, nameErr);
	const typeErr = validateFacilityType(body.type);
	if (typeErr) error(400, typeErr);
	if (!body.org_id) error(400, 'org_id is required.');

	const org = await getOrg(env, locals.user, body.org_id);
	if (!org) error(404, 'Org not found.');

	// If a district is supplied, it must exist, be visible, and belong to the org.
	if (body.district_id) {
		const district = await getDistrict(env, locals.user, body.district_id);
		if (!district || district.org_id !== body.org_id) {
			error(400, 'District does not belong to this org.');
		}
	}

	const facility = await createFacility(env, {
		org_id: body.org_id,
		district_id: body.district_id ?? null,
		name: body.name as string,
		type: (body.type as FacilityType) ?? null,
		address: body.address ?? null,
		zip: body.zip ?? null,
		phone: body.phone ?? null
	});
	await audit(env, locals.user.id, 'hierarchy.facility.create', `facility:${facility.id}`, request);
	await indexEntity(env, 'facility', facility.id, facility.name, facility.type ?? 'facility', `/facilities/${facility.id}`);
	return json({ facility }, { status: 201 });
};
