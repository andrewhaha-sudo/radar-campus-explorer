// /api/projects (Epic E4). POST creates a project under a building (staff/admin).
// A building is required (AC-4.1.2). Optional initial members.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getBuilding, isGlobalScope, validateName } from '$lib/server/hierarchy';
import { createProject, addMember } from '$lib/server/projects';
import { isValidMemberRole } from '$lib/engines/workflow/status';
import { indexEntity } from '$lib/server/search';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { name?: string; building_id?: string; members?: Array<{ userId: string; role: string }> };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	const nameErr = validateName(body.name);
	if (nameErr) error(400, nameErr);
	if (!body.building_id) error(400, 'A building is required to create a project.');

	const building = await getBuilding(env, locals.user, body.building_id);
	if (!building) error(404, 'Building not found.');

	const project = await createProject(env, {
		name: body.name as string,
		building_id: body.building_id,
		created_by: locals.user.id
	});
	for (const m of body.members ?? []) {
		if (m.userId && isValidMemberRole(m.role)) await addMember(env, locals.user.id, project.id, m.userId, m.role);
	}
	await audit(env, locals.user.id, 'project.create', `project:${project.id}`, request);
	await indexEntity(env, 'project', project.id, project.name, project.status, `/buildings/${building.id}`);
	return json({ project }, { status: 201 });
};
