// /api/floors/[id]/versions (Epic E15, AC-15.2.1). The plan history of a floor.
//
//   GET  lists every version, newest first, with is_current marking the plan
//        the viewer and the exporter draw
//   POST attaches a new (document, page) plan, superseding the current one
//
// POST does NOT touch markers. They belong to the floor, which is the whole
// point of the model: a re-survey must not strand the annotation work on the
// old PDF. Marker coordinates are normalized per page, so a redo at a different
// crop or scale does shift them - addFloorPlanVersion therefore snapshots the
// outgoing marker set and raises needs_review, so the drift is declared instead
// of silently accepted.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getFloor, addFloorPlanVersion, listFloorPlanVersions } from '$lib/server/floors';
import { getDocument } from '$lib/server/documents';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getFloor(locals.user, params.id, env))) error(404, 'Floor not found.');
	return json({ versions: await listFloorPlanVersions(locals.user, params.id, env) });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getFloor(locals.user, params.id, env))) error(404, 'Floor not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { docId?: unknown; page?: unknown; note?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (typeof body.docId !== 'string' || !body.docId) error(400, 'docId is required.');

	const page = body.page === undefined || body.page === null ? 1 : Number(body.page);
	if (!Number.isInteger(page) || page < 1) error(400, 'page must be a positive integer.');
	if (body.note !== undefined && body.note !== null && typeof body.note !== 'string')
		error(400, 'note must be a string.');

	// Scope the document independently: a floor the caller can see must not
	// become a way to attach a document they cannot.
	if (!(await getDocument(env, locals.user, body.docId))) error(404, 'Document not found.');

	const version = await addFloorPlanVersion(
		locals.user,
		params.id,
		{ docId: body.docId, page, note: (body.note as string | undefined) ?? undefined },
		env
	);
	if (!version) error(404, 'Floor not found.');
	await audit(env, locals.user.id, 'floor.addVersion', `floor:${params.id}`, request);
	return json({ version }, { status: 201 });
};
