// /api/admin/users (Epic E13). GET lists users; POST creates a user with an
// explicit role + initial password (AC-13.1.1). Admin only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { listUsers, createUser } from '$lib/server/admin';

const ROLES = ['admin', 'staff', 'client'] as const;

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');
	return json({ users: await listUsers(env) });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');

	let body: { name?: string; email?: string; password?: string; role?: string; org?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.name || !body.email || !body.password) error(400, 'name, email and password are required.');
	if (!ROLES.includes(body.role as (typeof ROLES)[number])) error(400, 'role must be admin, staff or client.');
	if (body.password.length < 8) error(400, 'Password must be at least 8 characters.');

	const id = await createUser(env, {
		name: body.name,
		email: body.email,
		password: body.password,
		role: body.role as (typeof ROLES)[number],
		org: body.org ?? null
	});
	if (!id) error(409, 'A user with that email already exists.');
	await audit(env, locals.user.id, 'admin.user.create', `user:${id}`, request);
	return json({ id }, { status: 201 });
};
