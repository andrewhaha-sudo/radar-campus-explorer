// /api/projects/[id]/versions (Epic E4). GET lists review versions; POST
// publishes a new version (staff/admin), notifying members (AC-4.3.1/4.3.2).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getProject, listVersions, publishVersion } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getProject(env, locals.user, params.id))) error(404, 'Project not found.');
	return json({ versions: await listVersions(env, params.id) });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const project = await getProject(env, locals.user, params.id);
	if (!project) error(404, 'Project not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { notes?: string };
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const version = await publishVersion(env, locals.user.id, project, body.notes ?? null);
	await audit(env, locals.user.id, 'project.version.publish', `project:${params.id}:v${version}`, request);
	return json({ ok: true, version }, { status: 201 });
};
