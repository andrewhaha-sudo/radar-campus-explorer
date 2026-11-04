// /api/admin/users/[id] (Epic E13). PATCH enables/disables a user. Admin only.
// Disabling is reversible and audited; users are never hard-deleted here.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { setUserActive, updateUserRole } from '$lib/server/admin';

const ROLES = ['admin', 'staff', 'client'];

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');

	let body: { active?: boolean; role?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	if (typeof body.active === 'boolean') {
		if (params.id === locals.user.id) error(400, 'You cannot change your own active state.');
		await setUserActive(env, params.id, body.active);
		await audit(env, locals.user.id, body.active ? 'admin.user.enable' : 'admin.user.disable', `user:${params.id}`, request);
	}
	if (body.role !== undefined) {
		if (!ROLES.includes(body.role)) error(400, 'Invalid role.');
		if (params.id === locals.user.id) error(400, 'You cannot change your own role.');
		await updateUserRole(env, params.id, body.role as 'admin' | 'staff' | 'client');
		await audit(env, locals.user.id, 'admin.user.role', `user:${params.id}:${body.role}`, request);
	}
	return json({ ok: true });
};
