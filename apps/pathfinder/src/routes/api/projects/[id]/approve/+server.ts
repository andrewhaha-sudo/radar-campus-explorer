// /api/projects/[id]/approve (Epic E4). Records an approval of the current
// (latest) version. Allowed for a project 'reviewer' member or staff/admin;
// a 'viewer' member or non-member is denied (AC-4.4.1/4.4.2).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getProject, listVersions, memberRole, recordApproval } from '$lib/server/projects';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const project = await getProject(env, locals.user, params.id);
	if (!project) error(404, 'Project not found.');

	const role = await memberRole(env, params.id, locals.user.id);
	const mayApprove = isGlobalScope(locals.user) || role === 'reviewer';
	if (!mayApprove) error(403, 'Only a reviewer may approve this project.');

	const versions = await listVersions(env, params.id);
	const current = versions[0]?.version ?? 1;
	await recordApproval(env, locals.user.id, project, current);
	await audit(env, locals.user.id, 'project.approve', `project:${params.id}:v${current}`, request);
	return json({ ok: true, version: current });
};
