// GET /api/auth/me (Epic E2). Returns the current user resolved from the JWT
// by hooks.server.ts (cookie or Authorization: Bearer), or 401 if anonymous.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Not authenticated.');
	return json({ user: locals.user });
};
