// /api/facilities/[id]/compliance (Epic E11). GET returns the facility's
// compliance metadata + computed staleness + missing NENA fields; PUT upserts
// the metadata (staff/admin). Scoped via getFacility.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getFacility, isGlobalScope } from '$lib/server/hierarchy';
import { getComplianceMeta, upsertComplianceMeta } from '$lib/server/compliance';
import { requiredFieldsMissing } from '$lib/engines/compliance/ng911';
import { isStale } from '$lib/engines/compliance/status';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const facility = await getFacility(env, locals.user, params.id);
	if (!facility) error(404, 'Facility not found.');

	const meta = await getComplianceMeta(env, params.id);
	const missing = requiredFieldsMissing({
		id: facility.id,
		name: facility.name,
		address: facility.address,
		zip: facility.zip,
		phone: facility.phone,
		type: facility.type,
		state: 'PA'
	});
	return json({
		meta,
		missingFields: missing,
		stale: isStale(meta?.last_reviewed ?? null, new Date().toISOString())
	});
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const facility = await getFacility(env, locals.user, params.id);
	if (!facility) error(404, 'Facility not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: {
		last_reviewed?: string;
		last_tour?: string;
		alyssas_law?: boolean;
		karis_law?: boolean;
		state_mandate?: string;
		drill_link?: string;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	await upsertComplianceMeta(env, params.id, {
		last_reviewed: body.last_reviewed ?? null,
		last_tour: body.last_tour ?? null,
		alyssas_law: body.alyssas_law ? 1 : 0,
		karis_law: body.karis_law ? 1 : 0,
		state_mandate: body.state_mandate ?? null,
		drill_link: body.drill_link ?? null
	});
	await audit(env, locals.user.id, 'compliance.meta.update', `facility:${params.id}`, request);
	return json({ ok: true });
};
