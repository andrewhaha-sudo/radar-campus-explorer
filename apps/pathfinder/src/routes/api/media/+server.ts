// /api/media (Epic E7). GET lists media assets under ?buildingId= or
// ?facilityId=, scoped to the caller (clients never see cold masters).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMedia } from '$lib/server/media';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const buildingId = url.searchParams.get('buildingId') || undefined;
	const facilityId = url.searchParams.get('facilityId') || undefined;
	if (!buildingId && !facilityId) error(400, 'buildingId or facilityId is required.');
	const media = await listMedia(env, locals.user, { buildingId, facilityId });
	return json({ media });
};
