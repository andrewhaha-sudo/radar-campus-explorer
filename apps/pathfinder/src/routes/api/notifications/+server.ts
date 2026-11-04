// /api/notifications (Epic E9). The caller's own recent notifications.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listNotifications } from '$lib/server/collab';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	return json({ notifications: await listNotifications(env, locals.user.id) });
};
