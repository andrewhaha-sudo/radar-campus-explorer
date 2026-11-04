// /api/admin/settings (Epic E13). GET lists deployment settings; PUT upserts
// one. Settings are read at runtime so behaviour changes without a code change
// (AC-13.4.1). Admin only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { listSettings, setSetting, getSetting } from '$lib/server/admin';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');
	return json({ settings: await listSettings(env) });
};

export const PUT: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');

	let body: { key?: string; value?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.key) error(400, 'key is required.');
	await setSetting(env, body.key, body.value ?? '', locals.user.id);
	await audit(env, locals.user.id, 'admin.setting.update', `setting:${body.key}`, request);
	return json({ ok: true, key: body.key, value: await getSetting(env, body.key) });
};
