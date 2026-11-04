// /api/admin/keys/[id] (Epic E13). DELETE revokes an API key (AC-13.2.2).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { revokeApiKey } from '$lib/server/admin';

export const DELETE: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');
	await revokeApiKey(env, params.id);
	await audit(env, locals.user.id, 'admin.key.revoke', `key:${params.id}`, request);
	return json({ ok: true });
};
