// /api/admin/keys (Epic E13). GET lists API keys (masked); POST issues a new
// scoped key and returns the RAW key ONCE. Admin only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { listApiKeys, createApiKey } from '$lib/server/admin';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');
	return json({ keys: await listApiKeys(env) });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');

	let body: { name?: string; userId?: string; scope?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.name) error(400, 'name is required.');
	const userId = body.userId || locals.user.id;
	const scope = body.scope === 'write' ? 'write' : 'read';
	const { id, rawKey, masked } = await createApiKey(env, {
		name: body.name,
		userId,
		scope,
		createdBy: locals.user.id
	});
	await audit(env, locals.user.id, 'admin.key.create', `key:${id}`, request);
	// rawKey is returned exactly once; only its hash is persisted.
	return json({ id, rawKey, masked, scope }, { status: 201 });
};
