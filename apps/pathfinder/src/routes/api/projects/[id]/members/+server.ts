// /api/projects/[id]/members (Epic E4). GET lists assigned members; POST adds
// or updates a member's role; DELETE (?userId=) removes one. Staff/admin only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getProject, listMembers, addMember, removeMember } from '$lib/server/projects';
import { isValidMemberRole } from '$lib/engines/workflow/status';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getProject(env, locals.user, params.id))) error(404, 'Project not found.');
	return json({ members: await listMembers(env, params.id) });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getProject(env, locals.user, params.id))) error(404, 'Project not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { userId?: string; role?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.userId) error(400, 'userId is required.');
	if (!isValidMemberRole(body.role)) error(400, 'role must be reviewer or viewer.');
	await addMember(env, locals.user.id, params.id, body.userId, body.role);
	return json({ ok: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ locals, platform, params, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getProject(env, locals.user, params.id))) error(404, 'Project not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const userId = url.searchParams.get('userId');
	if (!userId) error(400, 'userId query param is required.');
	await removeMember(env, locals.user.id, params.id, userId);
	return json({ ok: true });
};
