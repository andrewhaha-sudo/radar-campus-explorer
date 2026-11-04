// /api/activity (Epic E9). Recent activity feed. Authenticated; staff/admin see
// the global feed (clients are not exposed to cross-org activity).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recentActivity } from '$lib/server/collab';
import { isGlobalScope } from '$lib/server/hierarchy';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) return json({ activity: [] });
	return json({ activity: await recentActivity(env) });
};
