// Admin console (Epic E13). Admin-only: user management, API keys, platform
// stats and the audit viewer. Staff/clients are redirected.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listUsers, listApiKeys, platformStats, listSettings } from '$lib/server/admin';
import { exportAuditLog } from '$lib/server/compliance';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');

	const [users, apiKeys, stats, audit, settings] = await Promise.all([
		listUsers(env),
		listApiKeys(env),
		platformStats(env),
		exportAuditLog(env, 50),
		listSettings(env)
	]);
	return { users, apiKeys, stats, audit, settings };
};
